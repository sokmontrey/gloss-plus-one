import { afterEach, describe, expect, it, vi } from "vitest";
import { createReaderObserver } from "@/content/reader/observer";
import type { ExtractedParagraph } from "@/content/reader/types";

describe("createReaderObserver", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("debounces mutation bursts and emits only once", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const extract = vi
      .fn<() => ExtractedParagraph[]>()
      .mockReturnValueOnce([
        {
          index: 0,
          text: "A long paragraph with enough words to pass readability and be extracted correctly.",
          wordCount: 20,
          nodeRef: null,
          domPath: "html > body > main:nth-child(1)",
          readingOrder: 0,
        },
      ])
      .mockReturnValue([
        {
          index: 1,
          text: "A second paragraph appears after mutation and should be emitted in the delta batch.",
          wordCount: 20,
          nodeRef: null,
          domPath: "html > body > main:nth-child(2)",
          readingOrder: 1,
        },
      ]);

    const observer = createReaderObserver({
      debounceMs: 500,
      extract,
      onDelta: () => {
        calls += 1;
      },
    });

    observer.start();
    document.body.appendChild(document.createElement("div"));
    document.body.appendChild(document.createElement("div"));
    await Promise.resolve();
    vi.advanceTimersByTime(600);
    await Promise.resolve();
    observer.stop();

    // one initial emit + one debounced mutation emit
    expect(calls).toBe(2);
  });
});

