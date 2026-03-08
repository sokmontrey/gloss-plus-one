import { GLOSS_WRAPPER_CLASS } from "./types";
import { GLOSS_REVEALED_CLASS } from "./viewport";

/** Injected into the page for replacement wrappers. Scoped to avoid affecting host. */
export const OUTPUT_STYLES = `
.${GLOSS_WRAPPER_CLASS} {
  cursor: pointer;
  border-radius: 2px;
  padding: 0 1px;
  transition: background-color 0.4s ease, text-decoration-color 0.3s ease, opacity 0.3s ease;
}
.${GLOSS_WRAPPER_CLASS}[data-gloss-reinforcement="false"] {
  text-decoration: underline;
  text-decoration-color: rgba(251, 191, 36, 0.9);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  background-color: rgba(251, 191, 36, 0.18);
}
.${GLOSS_WRAPPER_CLASS}[data-gloss-reinforcement="true"] {
  text-decoration: underline;
  text-decoration-color: rgba(251, 191, 36, calc(0.8 - (var(--gloss-confidence, 0) * 0.7)));
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  background-color: rgba(251, 191, 36, calc(0.15 - (var(--gloss-confidence, 0) * 0.14)));
}
.${GLOSS_WRAPPER_CLASS}[data-gloss-phrase-type="structural"] {
  font-weight: 500;
}
.${GLOSS_WRAPPER_CLASS}[data-gloss-phrase-type="lexical"] {
  font-style: italic;
}
.${GLOSS_WRAPPER_CLASS}.${GLOSS_REVEALED_CLASS} {
  /* already at final state — animation fires via transition on class add */
}
.${GLOSS_WRAPPER_CLASS}:hover {
  background-color: rgba(251, 191, 36, 0.3) !important;
  text-decoration-color: rgba(251, 191, 36, 1) !important;
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
