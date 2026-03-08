import { enrichPageContent } from "./reader/enricher";
import { createMetrics } from "./reader/metrics";
import { resolveDomPath } from "./reader/domPath";
import { withReadOnlyDomGuard } from "./reader/runtimeGuards";
import { initSelectionPlayer, setSelectionPlayerEnabled } from "./overlay/selectionPlayer";
import { initHoverListeners, setHoverListenersEnabled } from "./overlay/tooltipManager";
import type {
  BackgroundToContentMessage,
  BankReadyReason,
  CurrentPageStatus,
  PopupToContentMessage,
  ReplacementInstruction,
  SerializableParagraph,
} from "@/shared/messages";
import { applyOutputAndAnimate, clearOutput, injectOutputStyles } from "./output";
import { DISABLED_PAGES_KEY, isPageDisabled, isPageDisabledInSnapshot } from "@/shared/pageDisable";
import type { BankPhrase, ProgressionConfig, UserContext } from "@/shared/types";
import type { PageContent } from "./reader/types";

injectOutputStyles(document);

const metrics = createMetrics(import.meta.env.DEV);
const processedParagraphKeys = new Set<string>();
let scrollTimer: ReturnType<typeof window.setTimeout> | null = null;
let mutationTimer: ReturnType<typeof window.setTimeout> | null = null;
let lastScrollY = window.scrollY;
let currentBank: BankPhrase[] = [];
let currentLanguage = "es";
let plannerRequested = false;
let hoverInitialized = false;
let selectionInitialized = false;
let initializingBadge: HTMLElement | null = null;
let latestPageContext: Pick<PageContent, "url" | "title" | "domain" | "pageType"> & { contentSnippet: string } | null = null;
let currentTier = 1;
let currentBatchId = "";
let pageDisabled = false;

const USER_CONTEXT_KEY = "userContext";
const CONFIG_KEY = "glossProgressionConfig";
const PROCESSED_SITE_LEVELS_KEY = "glossProcessedSiteLevels";
const PROCESSED_SITE_LEVEL_SIGNALS_KEY = "glossProcessedSiteLevelSignals";
const DEFAULT_USER_CONTEXT: Pick<UserContext, "targetLanguage" | "nativeLanguage"> = {
  targetLanguage: "es",
  nativeLanguage: "en",
};
const DEFAULT_PROGRESSION_CONFIG: ProgressionConfig = {
  progressionThreshold: 0.7,
  confidenceGainPerExposure: 0.03,
  confidenceDecayPerHover: 0.1,
  hoverDecayThresholdMs: 2000,
};

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function rangesOverlap(left: { start: number; end: number }, right: { start: number; end: number }): boolean {
  return left.start < right.end && right.start < left.end;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uppercaseFirstLetter(value: string): string {
  const index = value.search(/\p{L}/u);
  if (index === -1) {
    return value;
  }

  return `${value.slice(0, index)}${value[index].toUpperCase()}${value.slice(index + 1)}`;
}

function titleCaseWords(value: string): string {
  return value.replace(/\p{L}[\p{L}\p{M}'’-]*/gu, (word) => uppercaseFirstLetter(word.toLowerCase()));
}

function applyReplacementCasing(replacementText: string, matchedSource: string): string {
  if (!matchedSource) {
    return replacementText;
  }

  const lettersOnly = matchedSource.replace(/[^\p{L}\p{M}]+/gu, "");
  if (lettersOnly && lettersOnly === lettersOnly.toUpperCase()) {
    return replacementText.toUpperCase();
  }

  const sourceWords = matchedSource.match(/\p{L}[\p{L}\p{M}'’-]*/gu) ?? [];
  if (
    sourceWords.length > 1 &&
    sourceWords.every((word) => word[0] === word[0].toUpperCase())
  ) {
    return titleCaseWords(replacementText);
  }

  const firstLetterIndex = matchedSource.search(/\p{L}/u);
  if (firstLetterIndex !== -1 && matchedSource[firstLetterIndex] === matchedSource[firstLetterIndex].toUpperCase()) {
    return uppercaseFirstLetter(replacementText);
  }

  return replacementText;
}

function getTargetLanguageFromContextSnapshot(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<UserContext>;
  return typeof candidate.targetLanguage === "string" ? candidate.targetLanguage : null;
}

function buildInstructionsFromBank(
  paragraphs: SerializableParagraph[],
  bank: BankPhrase[],
): ReplacementInstruction[] {
  const instructions: ReplacementInstruction[] = [];
  const sortedBank = [...bank].sort((left, right) => right.phrase.length - left.phrase.length);

  for (const paragraph of paragraphs) {
    const sourceText = normalizeText(paragraph.text);
    const searchableText = sourceText.toLowerCase();
    const usedRanges: Array<{ start: number; end: number }> = [];

    for (const bankPhrase of sortedBank) {
      const phraseText = normalizeText(bankPhrase.phrase).toLowerCase();
      if (!phraseText) {
        continue;
      }

      // Fresh regex per paragraph/phrase prevents lastIndex leakage across paragraphs.
      const regex = new RegExp(`\\b${escapeRegExp(phraseText)}\\b`, "gi");
      let match: RegExpExecArray | null = null;

      while ((match = regex.exec(searchableText)) !== null) {
        const range = { start: match.index, end: match.index + match[0].length };
        if (usedRanges.some((usedRange) => rangesOverlap(usedRange, range))) {
          continue;
        }

        usedRanges.push(range);
        const matchedSource = sourceText.slice(range.start, range.end);
        instructions.push({
          id: crypto.randomUUID(),
          phraseId: bankPhrase.id,
          domPath: paragraph.domPath,
          sourceText,
          replacementText: applyReplacementCasing(bankPhrase.targetPhrase, matchedSource),
          start: range.start,
          end: range.end,
          targetLanguage: bankPhrase.targetLanguage,
          phraseType: bankPhrase.phraseType,
          confidence: bankPhrase.confidence,
          isReinforcement: bankPhrase.exposures > 0,
        });
      }
    }
  }

  return instructions;
}

function getParagraphKey(paragraph: SerializableParagraph): string {
  return `${paragraph.domPath}::${normalizeText(paragraph.text)}`;
}

function serializeParagraph(paragraph: PageContent["paragraphs"][number]): SerializableParagraph {
  return {
    index: paragraph.index,
    text: paragraph.text,
    wordCount: paragraph.wordCount,
    domPath: paragraph.domPath,
    readingOrder: paragraph.readingOrder,
  };
}

async function getPageUserContext(): Promise<Pick<UserContext, "targetLanguage" | "nativeLanguage">> {
  const result = await chrome.storage.local.get(USER_CONTEXT_KEY);
  const stored = result[USER_CONTEXT_KEY] as Partial<UserContext> | undefined;

  return {
    targetLanguage: stored?.targetLanguage ?? DEFAULT_USER_CONTEXT.targetLanguage,
    nativeLanguage: stored?.nativeLanguage ?? DEFAULT_USER_CONTEXT.nativeLanguage,
  };
}

async function getProgressionConfig(): Promise<ProgressionConfig> {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  return {
    ...DEFAULT_PROGRESSION_CONFIG,
    ...(result[CONFIG_KEY] as Partial<ProgressionConfig> | undefined),
  };
}

async function getBankPhrases(language: string): Promise<BankPhrase[]> {
  const response = (await chrome.runtime.sendMessage({
    type: "GET_BANK",
    payload: { language },
  })) as {
    language: string;
    phrases: BankPhrase[];
    currentTier: number;
    lastBatchId: string;
    reason: BankReadyReason;
  };

  currentTier = response.currentTier;
  currentBatchId = response.lastBatchId;
  return response.phrases;
}

function getSiteLevelKey(hostname: string, tier: number): string {
  return `${hostname}::tier-${tier}`;
}

function readProcessedSiteLevels(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(PROCESSED_SITE_LEVELS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function writeProcessedSiteLevels(values: Set<string>): void {
  try {
    window.sessionStorage.setItem(PROCESSED_SITE_LEVELS_KEY, JSON.stringify([...values]));
  } catch {
    // Ignore session storage failures and fall back to in-memory behavior.
  }
}

function shouldForceRefreshCurrentPage(reason: BankReadyReason): boolean {
  if (reason === "manual") {
    return true;
  }

  if (reason === "bank_sync" || reason === "debug_decrement") {
    return false;
  }

  const processed = readProcessedSiteLevels();
  const key = getSiteLevelKey(window.location.hostname, currentTier);
  if (processed.has(key)) {
    return false;
  }

  processed.add(key);
  writeProcessedSiteLevels(processed);
  return true;
}

function readProcessedSiteLevelSignals(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(PROCESSED_SITE_LEVEL_SIGNALS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function writeProcessedSiteLevelSignals(values: Set<string>): void {
  try {
    window.sessionStorage.setItem(PROCESSED_SITE_LEVEL_SIGNALS_KEY, JSON.stringify([...values]));
  } catch {
    // Ignore session storage failures.
  }
}

function shouldProcessCurrentSiteLevel(): boolean {
  const processed = readProcessedSiteLevelSignals();
  const key = getSiteLevelKey(window.location.hostname, currentTier);
  if (processed.has(key)) {
    return false;
  }

  processed.add(key);
  writeProcessedSiteLevelSignals(processed);
  return true;
}

function ensureInitializingBadge(): HTMLElement {
  if (initializingBadge?.isConnected) {
    return initializingBadge;
  }

  initializingBadge = document.createElement("div");
  initializingBadge.textContent = "GlossPlusOne initializing...";
  initializingBadge.style.cssText = [
    "position: fixed",
    "right: 12px",
    "bottom: 12px",
    "z-index: 2147483647",
    "padding: 8px 12px",
    "border-radius: 999px",
    "background: rgba(15, 23, 42, 0.92)",
    "color: white",
    "font: 12px/1.2 system-ui, sans-serif",
    "box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18)",
    "pointer-events: none",
  ].join(";");
  document.body.appendChild(initializingBadge);
  return initializingBadge;
}

function showInitializingState(): void {
  ensureInitializingBadge().style.display = "block";
}

function hideInitializingState(): void {
  if (initializingBadge) {
    initializingBadge.style.display = "none";
  }
}

function extractVisibleParagraphs(): SerializableParagraph[] {
  const run = metrics.start("delta");
  const content = withReadOnlyDomGuard(() => enrichPageContent(document));
  metrics.end(run);
  const contentSnippet = content.paragraphs
    .map((paragraph) => normalizeText(paragraph.text))
    .filter((paragraph) => paragraph.length > 0)
    .slice(0, 3)
    .join("\n\n")
    .slice(0, 900);
  latestPageContext = {
    url: content.url,
    title: content.title,
    domain: content.domain,
    pageType: content.pageType,
    contentSnippet,
  };

  const visibleParagraphs = content.paragraphs
    .map(serializeParagraph)
    .filter((paragraph) => {
      const paragraphKey = getParagraphKey(paragraph);
      if (processedParagraphKeys.has(paragraphKey)) return false;

      const el = resolveDomPath(paragraph.domPath);
      if (!el) return false;

      const rect = el.getBoundingClientRect();
      return rect.top < window.innerHeight * 2.5 && rect.bottom > -100;
    });

  console.log(
    `[GlossPlusOne:content] Extraction complete — ${visibleParagraphs.length} paragraphs`,
  );
  return visibleParagraphs;
}

function markParagraphsProcessed(paragraphs: SerializableParagraph[]): void {
  for (const paragraph of paragraphs) {
    processedParagraphKeys.add(getParagraphKey(paragraph));
  }
}

async function applyBankToVisibleParagraphs(forceRefresh = false): Promise<void> {
  if (pageDisabled || currentBank.length === 0) {
    return;
  }

  if (forceRefresh) {
    clearOutput(document);
    processedParagraphKeys.clear();
  }

  const paragraphs = extractVisibleParagraphs();
  if (paragraphs.length === 0) {
    return;
  }

  const instructions = buildInstructionsFromBank(paragraphs, currentBank);
  console.log(
    `[GlossPlusOne:content] Bank ${currentBank.length} phrases produced ${instructions.length} matches`,
  );

  markParagraphsProcessed(paragraphs);

  if (instructions.length > 0) {
    applyOutputAndAnimate(instructions);

    const pageContext = latestPageContext ?? {
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
      pageType: "unknown" as PageContent["pageType"],
      contentSnippet: "",
    };

    if (shouldProcessCurrentSiteLevel()) {
      void chrome.runtime.sendMessage({
        type: "REPORT_PAGE_SIGNAL",
        payload: {
          url: pageContext.url,
          title: pageContext.title,
          domain: pageContext.domain,
          pageType: pageContext.pageType,
          contentSnippet: pageContext.contentSnippet,
          replacementCount: instructions.length,
        },
      });

      void chrome.runtime.sendMessage({
        type: "CHECK_PROGRESSION",
        payload: { language: currentLanguage },
      });
    }

    for (const instruction of instructions) {
      void chrome.runtime.sendMessage({
        type: "RECORD_EXPOSURE",
        payload: {
          phraseId: instruction.phraseId,
          url: window.location.href,
          title: document.title,
          language: currentLanguage,
        },
      });
    }
  }
}

function applyPageDisabledState(disabled: boolean): void {
  const changed = pageDisabled !== disabled;
  pageDisabled = disabled;
  setHoverListenersEnabled(!disabled);
  setSelectionPlayerEnabled(!disabled);

  if (disabled) {
    hideInitializingState();
    clearOutput(document);
    processedParagraphKeys.clear();
    return;
  }

  if (changed) {
    processedParagraphKeys.clear();
    void initPage();
  }
}

async function initPage(): Promise<void> {
  const [userContext, config] = await Promise.all([getPageUserContext(), getProgressionConfig()]);
  currentLanguage = userContext.targetLanguage;

  applyPageDisabledState(await isPageDisabled(window.location.href));
  if (pageDisabled) {
    return;
  }

  if (!hoverInitialized) {
    initHoverListeners(config, userContext.targetLanguage, userContext.nativeLanguage, "structural");
    hoverInitialized = true;
  }
  setHoverListenersEnabled(true);

  if (!selectionInitialized) {
    initSelectionPlayer(userContext.targetLanguage);
    selectionInitialized = true;
  } else {
    initSelectionPlayer(userContext.targetLanguage);
  }
  setSelectionPlayerEnabled(true);

  currentBank = await getBankPhrases(currentLanguage);
  if (currentBank.length === 0) {
    showInitializingState();
    if (!plannerRequested) {
      plannerRequested = true;
      void chrome.runtime.sendMessage({
        type: "TRIGGER_PLANNER",
        payload: { reason: "initial", language: currentLanguage },
      });
    }
    return;
  }

  hideInitializingState();
  await applyBankToVisibleParagraphs();
}

const observer = new MutationObserver((records) => {
  if (pageDisabled) {
    return;
  }

  const hasAddedElements = records.some((record) =>
    Array.from(record.addedNodes).some((node) => node.nodeType === Node.ELEMENT_NODE),
  );

  if (!hasAddedElements) {
    return;
  }

  if (mutationTimer !== null) {
    window.clearTimeout(mutationTimer);
  }

  mutationTimer = window.setTimeout(() => {
    void applyBankToVisibleParagraphs();
  }, 500);
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}

window.addEventListener(
  "scroll",
  () => {
    if (pageDisabled) {
      return;
    }

    const nextScrollY = window.scrollY;
    const scrollingDown = nextScrollY > lastScrollY;
    lastScrollY = nextScrollY;

    if (!scrollingDown) {
      return;
    }

    if (scrollTimer !== null) {
      window.clearTimeout(scrollTimer);
    }

    scrollTimer = window.setTimeout(() => {
      void applyBankToVisibleParagraphs();
    }, 400);
  },
  { passive: true },
);

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundToContentMessage | PopupToContentMessage,
    _sender,
    sendResponse: (response?: CurrentPageStatus) => void,
  ) => {
    if (message.type === "GET_PAGE_STATUS") {
      sendResponse({
        url: window.location.href,
        disabled: pageDisabled,
      });
      return;
    }

    if (message.type !== "BANK_READY") {
      return;
    }

    if (message.payload.language !== currentLanguage) {
      return;
    }

    plannerRequested = false;
    currentBank = message.payload.phrases;
    currentTier = message.payload.currentTier;
    currentBatchId = message.payload.lastBatchId;
    hideInitializingState();

    if (pageDisabled) {
      return;
    }

    void applyBankToVisibleParagraphs(shouldForceRefreshCurrentPage(message.payload.reason));
  },
);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes[DISABLED_PAGES_KEY]) {
    const nextDisabled = isPageDisabledInSnapshot(window.location.href, changes[DISABLED_PAGES_KEY].newValue);
    if (nextDisabled !== pageDisabled) {
      applyPageDisabledState(nextDisabled);
    }
  }

  if (changes[USER_CONTEXT_KEY]) {
    const nextLanguage = getTargetLanguageFromContextSnapshot(changes[USER_CONTEXT_KEY].newValue);
    if (!nextLanguage || nextLanguage === currentLanguage) {
      return;
    }

    plannerRequested = false;
    currentLanguage = nextLanguage;
    currentBank = [];
    hideInitializingState();
    clearOutput(document);
    processedParagraphKeys.clear();
    void initPage();
  }
});

window.setTimeout(() => {
  void initPage();
}, 300);
