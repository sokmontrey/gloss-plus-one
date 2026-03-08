import { enrichPageContent } from "./reader/enricher";
import { createMetrics } from "./reader/metrics";
import { resolveDomPath } from "./reader/domPath";
import { withReadOnlyDomGuard } from "./reader/runtimeGuards";
import { initSelectionPlayer } from "./overlay/selectionPlayer";
import { initHoverListeners } from "./overlay/tooltipManager";
import type { BackgroundToContentMessage, ReplacementInstruction, SerializableParagraph } from "@/shared/messages";
import { applyOutputAndAnimate, injectOutputStyles } from "./output";
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

const USER_CONTEXT_KEY = "userContext";
const CONFIG_KEY = "glossProgressionConfig";
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
        instructions.push({
          id: crypto.randomUUID(),
          phraseId: bankPhrase.id,
          domPath: paragraph.domPath,
          sourceText,
          replacementText: bankPhrase.targetPhrase,
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
  return (await chrome.runtime.sendMessage({
    type: "GET_BANK",
    payload: { language },
  })) as BankPhrase[];
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

async function applyBankToVisibleParagraphs(): Promise<void> {
  if (currentBank.length === 0) {
    return;
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

  void chrome.runtime.sendMessage({
    type: "CHECK_PROGRESSION",
    payload: { language: currentLanguage },
  });
}

async function initPage(): Promise<void> {
  const [userContext, config] = await Promise.all([getPageUserContext(), getProgressionConfig()]);
  currentLanguage = userContext.targetLanguage;

  if (!hoverInitialized) {
    initHoverListeners(config, userContext.targetLanguage, userContext.nativeLanguage, "structural");
    hoverInitialized = true;
  }

  if (!selectionInitialized) {
    initSelectionPlayer(userContext.targetLanguage);
    selectionInitialized = true;
  } else {
    initSelectionPlayer(userContext.targetLanguage);
  }

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

chrome.runtime.onMessage.addListener((message: BackgroundToContentMessage) => {
  if (message.type !== "BANK_READY") {
    return;
  }

  plannerRequested = false;
  currentBank = message.payload;
  hideInitializingState();
  void applyBankToVisibleParagraphs();
});

window.setTimeout(() => {
  void initPage();
}, 300);
