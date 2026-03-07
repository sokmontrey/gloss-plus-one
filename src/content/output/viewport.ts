import { GLOSS_WRAPPER_CLASS } from "./types";

/** Class added once when the replacement wrapper has entered the viewport (one-shot animation). */
export const GLOSS_REVEALED_CLASS = "gloss-plus-one-revealed";

const observed = new WeakSet<Element>();

/**
 * Observe all current replacement wrappers under root and add the revealed class
 * when they enter the viewport (one-shot). Safe to call multiple times; already-observed
 * nodes are skipped.
 */
export function attachViewportAnimation(root: Document | Element = document): void {
  const scope = root instanceof Document ? root.documentElement : root;
  const wrappers = scope.querySelectorAll(`.${GLOSS_WRAPPER_CLASS}`);
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as Element;
        el.classList.add(GLOSS_REVEALED_CLASS);
        observer.unobserve(el);
      }
    },
    { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
  );
  wrappers.forEach((el) => {
    if (observed.has(el)) return;
    observed.add(el);
    observer.observe(el);
  });
}
