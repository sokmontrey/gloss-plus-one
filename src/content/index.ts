import { sendPageLoaded, sendRequestPlan, onApplyOutput } from "./bridge";
import { enrichPageContent } from "./reader/enricher";
import { createMetrics } from "./reader/metrics";
import { createReaderObserver } from "./reader/observer";
import { withReadOnlyDomGuard } from "./reader/runtimeGuards";
import type { BackgroundToContentMessage, ReplacementInstruction } from "@/shared/messages";
import { injectOutputStyles, applyOutputAndAnimate } from "./output";
import type { PageContent, ReplacementPlan } from "@/shared/types";

injectOutputStyles(document);

const metrics = createMetrics(import.meta.env.DEV);
let latestPageContent: PageContent | null = null;

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
  content: PageContent,
): ReplacementInstruction[] {
  const paragraphByIndex = new Map(content.paragraphs.map((paragraph) => [paragraph.index, paragraph]));
  let nextId = 0;

  return plans.flatMap((plan) => {
    const paragraph = paragraphByIndex.get(plan.paragraphIndex);
    if (!paragraph) {
      return [];
    }

    const sourceText = normalizeText(paragraph.text);
    const usedRanges: Array<{ start: number; end: number }> = [];

    return plan.replacements.flatMap((replacement) => {
      const range = findUnusedPhraseRange(
        sourceText,
        replacement.targetPhrase,
        replacement.caseSensitive,
        usedRanges,
      );

      if (!range) {
        console.warn("[GlossPlusOne] Could not map replacement onto paragraph text", replacement);
        return [];
      }

      usedRanges.push(range);

      return [
        {
          id: `plan-${plan.paragraphIndex}-${nextId++}`,
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
  latestPageContent = content;
  sendRequestPlan(trigger, content);
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

  console.group("[GlossPlusOne] PLAN_READY received");
  console.log("plans:", message.payload);
  console.log(
    "total replacements:",
    message.payload.reduce((sum, plan) => sum + plan.replacements.length, 0),
  );
  console.table(
    message.payload.flatMap((plan) =>
      plan.replacements.map((replacement) => ({
        paragraph: plan.paragraphIndex,
        target: replacement.targetPhrase,
        foreign: replacement.foreignPhrase,
        type: replacement.replacementType,
        reason: replacement.pedagogicalReason,
      })),
    ),
  );
  console.groupEnd();

  if (!latestPageContent) {
    return;
  }

  const instructions = buildInstructionsFromPlans(message.payload, latestPageContent);
  if (instructions.length > 0) {
    applyOutputAndAnimate(instructions);
  }
});
