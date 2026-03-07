import { sendPageLoaded, sendRequestPlan, onApplyOutput } from "./bridge";
import { enrichPageContent } from "./reader/enricher";
import { createMetrics } from "./reader/metrics";
import { resolveDomPath } from "./reader/domPath";
import { withReadOnlyDomGuard } from "./reader/runtimeGuards";
import type {
  BackgroundToContentMessage,
  ReplacementInstruction,
  SerializableParagraph,
} from "@/shared/messages";
import { injectOutputStyles, applyOutputAndAnimate } from "./output";
import type { PageContent } from "./reader/types";
import type { ReplacementPlan } from "@/shared/types";

injectOutputStyles(document);

const metrics = createMetrics(import.meta.env.DEV);
let lastExtractedParagraphs: SerializableParagraph[] = [];
const processedParagraphPaths = new Set<string>();
let pendingParagraphs: SerializableParagraph[] = [];
let planRequestPending = false;
let latestPageMeta: Pick<PageContent, "url" | "title" | "domain" | "pageType" | "language"> | null = null;
let scrollTimer: ReturnType<typeof window.setTimeout> | null = null;
let mutationTimer: ReturnType<typeof window.setTimeout> | null = null;

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

function serializeParagraph(paragraph: PageContent["paragraphs"][number]): SerializableParagraph {
  return {
    index: paragraph.index,
    text: paragraph.text,
    wordCount: paragraph.wordCount,
    domPath: paragraph.domPath,
    readingOrder: paragraph.readingOrder,
  };
}

function rememberParagraphs(paragraphs: SerializableParagraph[]) {
  const byPath = new Map(lastExtractedParagraphs.map((paragraph) => [paragraph.domPath, paragraph]));
  for (const paragraph of paragraphs) {
    byPath.set(paragraph.domPath, paragraph);
  }
  lastExtractedParagraphs = [...byPath.values()].sort((left, right) => left.index - right.index);
}

function queueParagraphs(paragraphs: SerializableParagraph[]) {
  const byPath = new Map(pendingParagraphs.map((paragraph) => [paragraph.domPath, paragraph]));
  for (const paragraph of paragraphs) {
    byPath.set(paragraph.domPath, paragraph);
  }
  pendingParagraphs = [...byPath.values()].sort((left, right) => left.index - right.index);
}

function getPageMeta(
  pageContent?: PageContent,
): Pick<PageContent, "url" | "title" | "domain" | "pageType" | "language"> {
  if (pageContent) {
    return {
      url: pageContent.url,
      title: pageContent.title,
      domain: pageContent.domain,
      pageType: pageContent.pageType,
      language: pageContent.language,
    };
  }

  if (latestPageMeta) {
    return latestPageMeta;
  }

  const content = withReadOnlyDomGuard(() => enrichPageContent(document));
  latestPageMeta = getPageMeta(content);
  return latestPageMeta;
}

function extractVisibleParagraphs(): SerializableParagraph[] {
  const run = metrics.start("delta");
  const content = withReadOnlyDomGuard(() => enrichPageContent(document));
  metrics.end(run);
  latestPageMeta = getPageMeta(content);

  const visibleParagraphs = content.paragraphs
    .map(serializeParagraph)
    .filter((paragraph) => {
      if (processedParagraphPaths.has(paragraph.domPath)) return false;

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

function requestPlanForParagraphs(paragraphs: SerializableParagraph[], trigger: "initial" | "scroll") {
  if (paragraphs.length === 0) return;

  if (planRequestPending) {
    queueParagraphs(paragraphs);
    return;
  }

  planRequestPending = true;
  rememberParagraphs(paragraphs);

  const pageMeta = getPageMeta();
  const content: PageContent = {
    ...pageMeta,
    paragraphs: paragraphs.map((paragraph) => ({
      ...paragraph,
      nodeRef: null,
    })),
    totalWordCount: paragraphs.reduce((sum, paragraph) => sum + paragraph.wordCount, 0),
    extractedAt: Date.now(),
  };

  sendRequestPlan(trigger === "initial" ? "initial" : "mutation", content);
  console.log("[GlossPlusOne:content] REQUEST_PLAN sent");
}

onApplyOutput((payload) => {
  applyOutputAndAnimate(payload);
});

sendPageLoaded();
window.setTimeout(() => {
  const initialParagraphs = extractVisibleParagraphs();
  requestPlanForParagraphs(initialParagraphs, "initial");
}, 300);

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
    const paragraphs = extractVisibleParagraphs();
    requestPlanForParagraphs(paragraphs, "scroll");
  }, 500);
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}

window.addEventListener(
  "scroll",
  () => {
    if (scrollTimer !== null) {
      window.clearTimeout(scrollTimer);
    }

    scrollTimer = window.setTimeout(() => {
      const newParagraphs = extractVisibleParagraphs();
      if (newParagraphs.length > 0) {
        requestPlanForParagraphs(newParagraphs, "scroll");
      }
    }, 400);
  },
  { passive: true },
);

chrome.runtime.onMessage.addListener((message: BackgroundToContentMessage) => {
  if (message.type !== "PLAN_READY") {
    return;
  }

  console.log(
    `[GlossPlusOne:content] PLAN_READY received — ${message.payload.length} plans`,
  );

  const freshPlans = message.payload.filter((plan) => {
    const paragraph = lastExtractedParagraphs.find((candidate) => candidate.index === plan.paragraphIndex);
    if (!paragraph) return false;
    if (processedParagraphPaths.has(paragraph.domPath)) return false;
    processedParagraphPaths.add(paragraph.domPath);
    return true;
  });

  const instructions = buildInstructionsFromPlans(freshPlans, lastExtractedParagraphs);
  console.log(
    `[GlossPlusOne:content] Built ${instructions.length} instructions from plans`,
  );
  planRequestPending = false;
  if (instructions.length > 0) {
    console.log("[GlossPlusOne:content] Applying instructions to DOM");
    observer.disconnect();
    applyOutputAndAnimate(instructions);
    requestAnimationFrame(() => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

  if (pendingParagraphs.length > 0) {
    const queuedParagraphs = pendingParagraphs.splice(0);
    requestPlanForParagraphs(queuedParagraphs, "scroll");
  }
});
