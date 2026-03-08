import { GLOSS_WRAPPER_CLASS } from "./types";
import { GLOSS_REVEALED_CLASS } from "./viewport";

/** Injected into the page for replacement wrappers. Scoped to avoid affecting host. */
export const OUTPUT_STYLES = `
.${GLOSS_WRAPPER_CLASS} {
  cursor: pointer;
  border-radius: 2px;
  padding: 0 1px;
  opacity: 0;
  transform: translateY(var(--gloss-entry-lift, 0.2em)) scale(0.985);
  filter: saturate(0.88);
  will-change: transform, opacity, background-color, text-decoration-color;
  transition:
    transform var(--gloss-entry-ms, 600ms) cubic-bezier(0.22, 1, 0.36, 1),
    opacity 320ms ease,
    filter 420ms ease,
    background-color 0.3s ease,
    text-decoration-color 0.3s ease;
}
.${GLOSS_WRAPPER_CLASS}[data-gloss-reinforcement="false"] {
  background-color: rgba(251, 191, 36, 0.2);
  text-decoration: underline;
  text-decoration-color: rgba(251, 191, 36, 0.9);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.${GLOSS_WRAPPER_CLASS}[data-gloss-reinforcement="true"] {
  background-color: rgba(251, 191, 36, calc(0.18 - (var(--gloss-confidence, 0) * 0.17)));
  text-decoration: underline;
  text-decoration-color: rgba(251, 191, 36, calc(0.9 - (var(--gloss-confidence, 0) * 0.8)));
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.${GLOSS_WRAPPER_CLASS}[data-gloss-phrase-type="structural"] {
  font-weight: 500;
}
.${GLOSS_WRAPPER_CLASS}[data-gloss-phrase-type="lexical"] {
  font-style: italic;
}
.${GLOSS_WRAPPER_CLASS}.${GLOSS_REVEALED_CLASS} {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: saturate(1);
  animation: gloss-plus-one-informed-entry var(--gloss-entry-ms, 600ms) cubic-bezier(0.22, 1, 0.36, 1) var(--gloss-entry-delay, 0ms) both;
}
.${GLOSS_WRAPPER_CLASS}:hover {
  background-color: rgba(251, 191, 36, 0.3) !important;
  outline: 1px solid rgba(251, 191, 36, 0.6);
  border-radius: 2px;
}

@keyframes gloss-plus-one-informed-entry {
  0% {
    opacity: 0;
    transform: translateY(var(--gloss-entry-lift, 0.2em)) scale(0.985);
    filter: saturate(0.86);
  }
  55% {
    opacity: 1;
    transform: translateY(-0.05em) scale(1.012);
    filter: saturate(1.03);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: saturate(1);
  }
}
`;

let styleEl: HTMLStyleElement | null = null;

/** Inject output styles into the document once. */
export function injectOutputStyles(doc: Document = document): void {
  if (styleEl?.isConnected) return;
  styleEl = doc.createElement("style");
  styleEl.textContent = OUTPUT_STYLES;
  styleEl.setAttribute("data-gloss-plus-one", "output-styles");
  (doc.head ?? doc.documentElement).appendChild(styleEl);
}
