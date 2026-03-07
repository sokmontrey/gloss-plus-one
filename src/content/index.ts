import { sendPageLoaded, sendRequestPlan, onApplyOutput } from "./bridge";
import { enrichPageContent } from "./reader/enricher";
import { createMetrics } from "./reader/metrics";
import { createReaderObserver } from "./reader/observer";
import { withReadOnlyDomGuard } from "./reader/runtimeGuards";
import type {
  BackgroundToContentMessage,
  ReplacementInstruction,
  SerializableParagraph,
} from "@/shared/messages";
import { injectOutputStyles, applyOutputAndAnimate } from "./output";
import type { ReplacementPlan } from "@/shared/types";

injectOutputStyles(document);

const metrics = createMetrics(import.meta.env.DEV);
let lastExtractedParagraphs: SerializableParagraph[] = [];

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function rangesOverlap(
  left: { start: number; end: number },
  right: { start: number; end: number },
): boolean {
  return left.start < right.end && right.start < left.end;
}

function findUnusedPhraseRange(
  text: string,
  phrase: string,
  caseSensitive: boolean,
  usedRanges: Array<{ start: number; end: number }>,
): { start: number; end: number } | null {
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? phrase : phrase.toLowerCase();

  let fromIndex = 0;
  while (fromIndex < haystack.length) {
    const start = haystack.indexOf(needle, fromIndex);
    if (start === -1) {
      return null;
    }

    const match = { start, end: start + phrase.length };
    if (!usedRanges.some((range) => rangesOverlap(range, match))) {
      return match;
    }

    fromIndex = start + 1;
  }

  return null;
}

function buildInstructionsFromPlans(
  plans: ReplacementPlan[],
  paragraphs: SerializableParagraph[],
): ReplacementInstruction[] {
  const paragraphByIndex = new Map(paragraphs.map((paragraph) => [paragraph.index, paragraph]));

  return plans.flatMap((plan) => {
    const paragraph = paragraphByIndex.get(plan.paragraphIndex);
    if (!paragraph) {
      console.warn(
        `[GlossPlusOne:content] No paragraph found for index ${plan.paragraphIndex}`,
      );
      return [];
    }

    const sourceText = normalizeText(plan.originalText);
    const usedRanges: Array<{ start: number; end: number }> = [];

    return plan.replacements.flatMap((replacement) => {
      const range = findUnusedPhraseRange(
        sourceText,
        replacement.targetPhrase,
        replacement.caseSensitive,
        usedRanges,
      );

      if (!range) {
        console.warn(
          `[GlossPlusOne:content] targetPhrase not found in originalText: "${replacement.targetPhrase}"`,
        );
        return [];
      }

      usedRanges.push(range);

      return [
        {
          id: crypto.randomUUID(),
          domPath: paragraph.domPath,
          sourceText,
          replacementText: replacement.foreignPhrase,
          start: range.start,
          end: range.end,
        },
      ];
    });
  });
}

function runExtraction(trigger: "initial" | "mutation") {
  const run = metrics.start(trigger === "initial" ? "initial" : "delta");
  const content = withReadOnlyDomGuard(() => enrichPageContent(document));
  metrics.end(run);
  lastExtractedParagraphs = content.paragraphs.map((paragraph) => ({
    index: paragraph.index,
    text: paragraph.text,
    wordCount: paragraph.wordCount,
    domPath: paragraph.domPath,
    readingOrder: paragraph.readingOrder,
  }));
  console.log(
    `[GlossPlusOne:content] Extraction complete — ${lastExtractedParagraphs.length} paragraphs`,
  );
  sendRequestPlan(trigger, content);
  console.log("[GlossPlusOne:content] REQUEST_PLAN sent");
}

onApplyOutput((payload) => {
  applyOutputAndAnimate(payload);
});

sendPageLoaded();
window.setTimeout(() => runExtraction("initial"), 300);

const observer = createReaderObserver({
  debounceMs: 500,
  extract: () => withReadOnlyDomGuard(() => enrichPageContent(document).paragraphs),
  onDelta: (delta) => {
    if (delta.reason !== "mutation") return;
    runExtraction("mutation");
  },
});

observer.start();

chrome.runtime.onMessage.addListener((message: BackgroundToContentMessage) => {
  if (message.type !== "PLAN_READY") {
    return;
  }

  console.log(
    `[GlossPlusOne:content] PLAN_READY received — ${message.payload.length} plans`,
  );
  const instructions = buildInstructionsFromPlans(message.payload, lastExtractedParagraphs);
  console.log(
    `[GlossPlusOne:content] Built ${instructions.length} instructions from plans`,
  );
  if (instructions.length > 0) {
    console.log("[GlossPlusOne:content] Applying instructions to DOM");
    applyOutputAndAnimate(instructions);
  }
});
