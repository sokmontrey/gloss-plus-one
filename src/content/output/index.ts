import type { ReplacementInstruction } from "@/shared/messages";
import { applyOutput } from "./renderer";
import { attachViewportAnimation } from "./viewport";
import { injectOutputStyles } from "./styles";

export { applyOutput, applyReplacement } from "./renderer";
export { clearOutput } from "./renderer";
export { attachViewportAnimation, GLOSS_REVEALED_CLASS } from "./viewport";
export { injectOutputStyles, OUTPUT_STYLES } from "./styles";
export { GLOSS_MARKER_ATTR, GLOSS_SOURCE_ATTR, GLOSS_WRAPPER_CLASS } from "./types";

/**
 * Apply replacement instructions, then attach viewport animation to new wrappers.
 * Call after injecting styles (e.g. at content script init).
 */
export function applyOutputAndAnimate(instructions: ReplacementInstruction[]): void {
  applyOutput(instructions);
  attachViewportAnimation();
}
