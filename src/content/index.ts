import { extractParagraphs } from "./reader/parser";
import { enrichPageContent } from "./reader/enricher";
import { resolveDomPath } from "./reader/domPath";
import { applyOutputAndAnimate, clearOutput, injectOutputStyles } from "./output";
import { initHoverListeners } from "./overlay/tooltipManager";
import { initSelectionPlayer } from "./overlay/selectionPlayer";
import { isPageDisabled } from "@/shared/pageDisable";
import { BANK_KEY, getPhraseBankFromSnapshot } from "@/shared/phraseBankStorage";
import { getActivePhrases } from "@/shared/structuralPhrases";
import type { ReplacementInstruction } from "@/shared/messages";
import type { BankPhrase, UserContext } from "@/shared/types";

injectOutputStyles(document);

const USER_CONTEXT_KEY = "userContext";

let userContext: UserContext | null = null;
let initialized = false;
let waitingForInitialBank = false;
let discoveryStarted = false;
let currentTier = 1;
let lastPhraseSignature = "";

function getRenderableBank(bank: BankPhrase[], tier: number): BankPhrase[] {
  const activeStructuralPhrases = new Set(
    getActivePhrases(tier).map((phrase) => phrase.phrase),
  );
  return bank.filter((phrase) => {
    if (phrase.phraseType !== "structural") {
      return true;
    }
    return activeStructuralPhrases.has(phrase.phrase);
  });
}

function getPhraseSignature(bank: BankPhrase[], tier: number): string {
  return bank
    .map((phrase) => `${phrase.id}:${phrase.phrase}:${phrase.targetPhrase}`)
    .sort()
    .join("|") + `::tier=${tier}`;
}

function buildInstructions(
  paragraphs: ReturnType<typeof extractParagraphs>,
  bank: BankPhrase[],
): ReplacementInstruction[] {
  const instructions: ReplacementInstruction[] = [];
  const sorted = [...bank].sort((left, right) => right.phrase.length - left.phrase.length);

  for (const paragraph of paragraphs) {
    const usedRanges: Array<[number, number]> = [];

    for (const bankPhrase of sorted) {
      const escaped = bankPhrase.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");

      let match: RegExpExecArray | null;
      while ((match = regex.exec(paragraph.text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const overlaps = usedRanges.some(([rangeStart, rangeEnd]) => start < rangeEnd && end > rangeStart);
        if (overlaps) {
          continue;
        }

        usedRanges.push([start, end]);
        instructions.push({
          id: crypto.randomUUID(),
          phraseId: bankPhrase.id,
          domPath: paragraph.domPath,
          sourceText: paragraph.text,
          replacementText: bankPhrase.targetPhrase,
          start,
          end,
          confidence: bankPhrase.confidence,
          isReinforcement: bankPhrase.exposures > 0,
          targetLanguage: bankPhrase.targetLanguage,
          phraseType: bankPhrase.phraseType,
        });
      }
    }
  }

  return instructions;
}

async function boot(): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  const disabled = await isPageDisabled(window.location.href);
  if (disabled) {
    return;
  }

  userContext = await getUserContextLocal();
  initHoverListeners();
  initSelectionPlayer(userContext.targetLanguage);

  const rendered = await runPathA();
  if (rendered) {
    startPathB();
  }
}

async function runPathA(): Promise<boolean> {
  const bank = await getBankLocal(userContext!.targetLanguage);
  currentTier = bank.currentTier;
  const renderableBank = getRenderableBank(bank.phrases, currentTier);
  lastPhraseSignature = getPhraseSignature(renderableBank, currentTier);

  if (renderableBank.length === 0) {
    waitingForInitialBank = true;
    chrome.runtime.sendMessage({
      type: "ENSURE_STRUCTURAL_TRANSLATIONS",
      payload: { language: userContext!.targetLanguage },
    });
    listenForBankAndRender();
    return false;
  }

  renderFromBank(renderableBank);
  return true;
}

function renderFromBank(bank: BankPhrase[]): void {
  const paragraphs = extractParagraphs().slice(0, 50);
  if (paragraphs.length === 0) {
    console.log("[GlossPlusOne:content] No readable paragraphs found");
    return;
  }

  const instructions = buildInstructions(paragraphs, bank);

  console.log(
    `[GlossPlusOne:content] Bank: ${bank.length} phrases | ` +
      `Paragraphs: ${paragraphs.length} | Matches: ${instructions.length}`,
  );

  if (instructions.length === 0) {
    console.warn(
      "[GlossPlusOne:content] Zero matches.",
      "Sample bank phrases:",
      bank.slice(0, 3).map((phrase) => phrase.phrase),
      "Sample text:",
      paragraphs[0]?.text?.slice(0, 80),
    );
    return;
  }

  // Only rerender paragraphs that actually have matches. This avoids the
  // whole-page flash back to source text when new phrases are discovered.
  const affectedDomPaths = new Set(instructions.map((instruction) => instruction.domPath));
  for (const domPath of affectedDomPaths) {
    const element = resolveDomPath(domPath);
    if (element) {
      clearOutput(element);
    }
  }

  applyOutputAndAnimate(instructions);

  for (const instruction of instructions) {
    void chrome.runtime.sendMessage({
      type: "RECORD_EXPOSURE",
      payload: {
        phraseId: instruction.phraseId,
        url: window.location.href,
        title: document.title,
        language: userContext!.targetLanguage,
      },
    });
  }
}

function startPathB(): void {
  if (discoveryStarted || !userContext) {
    return;
  }
  discoveryStarted = true;
  void runPathB();
}

async function runPathB(): Promise<void> {
  const pageContent = enrichPageContent();
  const pageText = pageContent.paragraphs
    .slice(0, 6)
    .map((paragraph) => paragraph.text)
    .join(" ")
    .slice(0, 800);

  if (pageText.length < 100) {
    return;
  }

  chrome.runtime.sendMessage({
    type: "RUN_PAGE_DISCOVERY",
    payload: {
      pageText,
      pageTitle: document.title,
      pageUrl: window.location.href,
      language: userContext!.targetLanguage,
    },
  });
}

function listenForBankAndRender(): void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== "local" || !changes[BANK_KEY]?.newValue || !userContext) {
      return;
    }

    const bank = getPhraseBankFromSnapshot(changes[BANK_KEY].newValue, userContext.targetLanguage);
    currentTier = bank.currentTier;
    const renderableBank = getRenderableBank(bank.phrases, currentTier);
    if (renderableBank.length === 0) {
      return;
    }

    const nextSignature = getPhraseSignature(renderableBank, currentTier);
    if (nextSignature === lastPhraseSignature) {
      return;
    }

    lastPhraseSignature = nextSignature;
    chrome.storage.onChanged.removeListener(handler);
    waitingForInitialBank = false;
    console.log("[GlossPlusOne:content] Bank arrived, rendering");
    renderFromBank(renderableBank);
    startPathB();
  };

  chrome.storage.onChanged.addListener(handler);
}

async function getUserContextLocal(): Promise<UserContext> {
  const result = await chrome.storage.local.get(USER_CONTEXT_KEY);
  const stored = result[USER_CONTEXT_KEY] as Partial<UserContext> | undefined;

  return {
    cefrBand: stored?.cefrBand ?? "A2",
    cefrConfidence: stored?.cefrConfidence ?? 30,
    targetLanguage: stored?.targetLanguage ?? "es",
    nativeLanguage: stored?.nativeLanguage ?? "en",
    knownPhrases: stored?.knownPhrases ?? [],
    immersionIntensity: stored?.immersionIntensity ?? 0.35,
    sessionFatigueSignal: stored?.sessionFatigueSignal ?? false,
    sessionDepth: stored?.sessionDepth ?? 0,
    phraseState: stored?.phraseState ?? {
      seenPhrases: [],
      pendingIntroductions: [],
      totalSessionCount: 0,
      lastSessionAt: 0,
    },
    progressionThreshold: stored?.progressionThreshold ?? 0.6,
    debugLearnerLevel: stored?.debugLearnerLevel ?? 0,
  };
}

async function getBankLocal(language: string): Promise<{
  phrases: BankPhrase[];
  currentTier: number;
}> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_BANK", payload: { language } },
      (
        response:
          | {
              phrases?: BankPhrase[];
              currentTier?: number;
            }
          | undefined,
      ) => {
        resolve({
          phrases: response?.phrases ?? [],
          currentTier: response?.currentTier ?? 1,
        });
      },
    );
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !initialized) {
    return;
  }

  if (changes[USER_CONTEXT_KEY]) {
    void getUserContextLocal().then(async (nextContext) => {
      userContext = nextContext;
      initSelectionPlayer(nextContext.targetLanguage);
      discoveryStarted = false;
      waitingForInitialBank = false;
      clearOutput(document);
      const rendered = await runPathA();
      if (rendered) {
        startPathB();
      }
    });
    return;
  }

  if (!changes[BANK_KEY]?.newValue || !userContext) {
    return;
  }

  const bank = getPhraseBankFromSnapshot(changes[BANK_KEY].newValue, userContext.targetLanguage);
  currentTier = bank.currentTier;
  const renderableBank = getRenderableBank(bank.phrases, currentTier);
  const nextSignature = getPhraseSignature(renderableBank, currentTier);
  if (nextSignature === lastPhraseSignature) {
    return;
  }

  lastPhraseSignature = nextSignature;
  if (renderableBank.length === 0) {
    clearOutput(document);
    return;
  }

  renderFromBank(renderableBank);
  if (waitingForInitialBank) {
    waitingForInitialBank = false;
    startPathB();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void boot();
  });
} else {
  void boot();
}
