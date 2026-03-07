import { sendPageLoaded, sendRequestPlan } from "./bridge";
import { enrichPageContent } from "./reader/enricher";
import { createMetrics } from "./reader/metrics";
import { createReaderObserver } from "./reader/observer";
import { withReadOnlyDomGuard } from "./reader/runtimeGuards";
import type { BackgroundToContentMessage } from "@/shared/messages";

const metrics = createMetrics(import.meta.env.DEV);

function runExtraction(trigger: "initial" | "mutation") {
  const run = metrics.start(trigger === "initial" ? "initial" : "delta");
  const content = withReadOnlyDomGuard(() => enrichPageContent(document));
  metrics.end(run);
  sendRequestPlan(trigger, content);
}

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
});
