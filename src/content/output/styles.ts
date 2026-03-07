import { GLOSS_WRAPPER_CLASS } from "./types";
import { GLOSS_REVEALED_CLASS } from "./viewport";

/** Injected into the page for replacement wrappers. Scoped to avoid affecting host. */
export const OUTPUT_STYLES = `
.${GLOSS_WRAPPER_CLASS} {
  text-decoration: underline;
  text-decoration-color: rgba(251, 191, 36, 0.6);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  cursor: pointer;
  transition: background-color 0.4s ease, text-decoration-color 0.3s ease;
  border-radius: 2px;
  padding: 0 1px;
}
.${GLOSS_WRAPPER_CLASS}.${GLOSS_REVEALED_CLASS} {
  background-color: rgba(251, 191, 36, 0.15);
  text-decoration-color: rgba(251, 191, 36, 0.9);
}
.${GLOSS_WRAPPER_CLASS}:hover {
  background-color: rgba(251, 191, 36, 0.25);
  text-decoration-color: rgba(251, 191, 36, 1);
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
