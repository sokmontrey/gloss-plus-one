import { GLOSS_WRAPPER_CLASS } from "./types";
import { GLOSS_REVEALED_CLASS } from "./viewport";

/** Injected into the page for replacement wrappers. Scoped to avoid affecting host. */
export const OUTPUT_STYLES = `
.${GLOSS_WRAPPER_CLASS} {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
  text-decoration-color: rgba(180, 160, 100, 0.6);
  transition: text-decoration-color 0.2s ease, background-color 0.2s ease;
}
.${GLOSS_WRAPPER_CLASS}.${GLOSS_REVEALED_CLASS} {
  text-decoration-color: rgba(180, 160, 100, 0.85);
  background-color: rgba(255, 248, 220, 0.35);
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
