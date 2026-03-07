import { sendPageLoaded, sendRequestPlan } from "./bridge";
import { enrichPageContent } from "./reader/enricher";
import { createMetrics } from "./reader/metrics";
import { createReaderObserver } from "./reader/observer";
import { withReadOnlyDomGuard } from "./reader/runtimeGuards";

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
