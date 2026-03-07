export function withReadOnlyDomGuard<T>(fn: () => T): T {
  const before = document.documentElement.outerHTML.length;
  const result = fn();
  const after = document.documentElement.outerHTML.length;

  // Guardrail for accidental mutations in extraction pipeline.
  if (before !== after) {
    console.warn("[GlossPlusOne] Extraction changed DOM unexpectedly.");
  }

  return result;
}

