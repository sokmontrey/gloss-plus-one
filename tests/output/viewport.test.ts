import { describe, expect, it, vi } from "vitest";
import { attachViewportAnimation, GLOSS_REVEALED_CLASS } from "@/content/output/viewport";
import { GLOSS_WRAPPER_CLASS } from "@/content/output/types";
import { loadFixture, setDocument } from "../helpers/dom";
import { applyReplacement } from "@/content/output/renderer";
import { buildDomPath } from "@/content/reader/domPath";
import type { ReplacementInstruction } from "@/shared/messages";

describe("viewport animation", () => {
  it("adds revealed class once when wrapper enters view (one-shot)", () => {
    let callback: (entries: IntersectionObserverEntry[]) => void;
    const observe = vi.fn();
    const unobserve = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(function (cb: (entries: IntersectionObserverEntry[]) => void) {
        callback = cb;
        return { observe, unobserve, disconnect: vi.fn() };
      })
    );

    setDocument(loadFixture("single-p.html"));
    const p = document.querySelector("p#single")!;
    const path = buildDomPath(p);
    const sourceText = (p.textContent ?? "").replace(/\s+/g, " ").trim();
    const start = sourceText.indexOf("quick");
    const inst: ReplacementInstruction = {
      id: "v1",
      domPath: path,
      sourceText,
      replacementText: "quick",
      start,
      end: start + 5,
    };
    applyReplacement(inst);

    const wrapper = p.querySelector(`.${GLOSS_WRAPPER_CLASS}`);
    expect(wrapper).toBeTruthy();
    expect(wrapper?.classList.contains(GLOSS_REVEALED_CLASS)).toBe(false);

    attachViewportAnimation(document);

    const entry: IntersectionObserverEntry = {
      isIntersecting: true,
      target: wrapper!,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: 1,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: 0,
    };
    callback!([entry]);

    expect(wrapper?.classList.contains(GLOSS_REVEALED_CLASS)).toBe(true);
    expect(unobserve).toHaveBeenCalledWith(wrapper);

    vi.unstubAllGlobals();
  });
});
