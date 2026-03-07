import type { ExtractedParagraph } from "./types";

export interface DeltaBatch {
  reason: "initial" | "mutation";
  paragraphs: ExtractedParagraph[];
}

export interface ReaderObserverOptions {
  debounceMs?: number;
  extract: (root?: ParentNode) => ExtractedParagraph[];
  onDelta: (delta: DeltaBatch) => void;
}

export function createReaderObserver(options: ReaderObserverOptions): {
  start: () => void;
  stop: () => void;
} {
  const debounceMs = options.debounceMs ?? 500;
  const seen = new Set<string>();
  let timer: number | null = null;
  let observer: MutationObserver | null = null;

  const emitNew = (reason: "initial" | "mutation", root?: ParentNode) => {
    const rows = options.extract(root).filter((p) => {
      if (seen.has(p.domPath)) return false;
      seen.add(p.domPath);
      return true;
    });
    if (rows.length) options.onDelta({ reason, paragraphs: rows });
  };

  const schedule = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => emitNew("mutation"), debounceMs);
  };

  return {
    start: () => {
      emitNew("initial", document);
      observer = new MutationObserver((records) => {
        const hasAddedElements = records.some((r) =>
          Array.from(r.addedNodes).some((n) => n.nodeType === Node.ELEMENT_NODE),
        );
        if (hasAddedElements) schedule();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    },
    stop: () => {
      if (timer !== null) window.clearTimeout(timer);
      observer?.disconnect();
      observer = null;
    },
  };
}

