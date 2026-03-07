import type { ReplacementInstruction } from "@/shared/messages";
import { resolveDomPath } from "@/content/reader/domPath";
import {
  GLOSS_MARKER_ATTR,
  GLOSS_SOURCE_ATTR,
  GLOSS_WRAPPER_CLASS,
} from "./types";

function getTextNodesInOrder(root: Element): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes: Text[] = [];
  let n: Text | null;
  while ((n = walker.nextNode() as Text | null)) nodes.push(n);
  return nodes;
}

function getChunksFromElement(element: Element): { raw: string; normalized: string }[] {
  const raw = getTextNodesInOrder(element)
    .map((n) => n.textContent ?? "")
    .join("");
  if (element.tagName.toLowerCase() === "p") {
    const normalized = raw.replace(/\s+/g, " ").trim();
    return normalized ? [{ raw: raw.trim(), normalized }] : [];
  }
  const parts = raw.replace(/\n{3,}/g, "\n\n").split(/\n\s*\n/g);
  return parts.map((p) => {
    const trimmed = p.trim();
    return { raw: trimmed, normalized: trimmed.replace(/\s+/g, " ").trim() };
  }).filter((c) => c.normalized.length > 0);
}

/** Map offset in normalized text to offset in raw text (collapse spaces). */
function normalizedToRawOffset(raw: string, normalizedOffset: number): number {
  let normCount = 0;
  let rawIdx = 0;
  while (rawIdx < raw.length && normCount < normalizedOffset) {
    if (/\s/.test(raw[rawIdx])) {
      while (rawIdx < raw.length && /\s/.test(raw[rawIdx])) rawIdx++;
      normCount++;
    } else {
      rawIdx++;
      normCount++;
    }
  }
  return rawIdx;
}

/** Map fullRaw and chunk index to (chunkStart, length) in fullRaw; chunk is trimmed. */
function getChunkRangeInFullRaw(
  fullRaw: string,
  chunkIndex: number,
  isP: boolean
): { start: number; length: number } | null {
  if (isP) {
    const trimmed = fullRaw.trim();
    if (!trimmed) return null;
    const start = fullRaw.indexOf(trimmed);
    return start >= 0 ? { start, length: trimmed.length } : null;
  }
  const normalized = fullRaw.replace(/\n{3,}/g, "\n\n");
  const re = /\n\s*\n/g;
  let chunkStart = 0;
  let i = 0;
  while (i <= chunkIndex) {
    const next = re.exec(normalized);
    if (i === chunkIndex) {
      const segmentEnd = next ? next.index : normalized.length;
      const segment = normalized.slice(chunkStart, segmentEnd);
      const trimmed = segment.trim();
      if (!trimmed) return null;
      const lead = segment.length - segment.trimStart().length;
      return { start: chunkStart + lead, length: trimmed.length };
    }
    if (!next) return null;
    chunkStart = next.index + next[0].length;
    i++;
  }
  return null;
}

/**
 * Apply a single replacement: resolve target, find range, wrap with span.
 * Skips if a wrapper with this id already exists. Does not replace if text doesn't match.
 */
export function applyReplacement(instruction: ReplacementInstruction): boolean {
  const expectedPhrase = instruction.sourceText.slice(instruction.start, instruction.end);
  console.log(
    `[GlossPlusOne:renderer] Applying instruction: domPath=${instruction.domPath} phrase=${JSON.stringify(expectedPhrase)} replacement=${JSON.stringify(instruction.replacementText)}`,
  );
  const el = resolveDomPath(instruction.domPath);
  if (!el) {
    console.warn(`[GlossPlusOne:renderer] WARN: domPath not resolved: ${instruction.domPath}`);
    return false;
  }

  if (el.querySelector(`[${GLOSS_MARKER_ATTR}="${instruction.id}"]`)) return true;

  const chunks = getChunksFromElement(el);
  const normalizedSource = instruction.sourceText.replace(/\s+/g, " ").trim();
  const chunkIndex = chunks.findIndex((c) => c.normalized === normalizedSource);
  if (chunkIndex === -1) return false;

  const chunk = chunks[chunkIndex];
  const actualPhrase = chunk.normalized.slice(instruction.start, instruction.end);
  if (actualPhrase !== expectedPhrase) {
    console.warn(`[GlossPlusOne:renderer] WARN: phrase not found in text node: ${expectedPhrase}`);
    return false;
  }
  const rawStart = normalizedToRawOffset(chunk.raw, Math.min(instruction.start, chunk.normalized.length));
  const rawEnd = normalizedToRawOffset(chunk.raw, Math.min(instruction.end, chunk.normalized.length));
  if (rawStart >= chunk.raw.length || rawEnd > chunk.raw.length || rawStart >= rawEnd)
    return false;

  const textNodes = getTextNodesInOrder(el);
  let fullRaw = "";
  const nodeRanges: { node: Text; start: number; end: number }[] = [];
  for (const node of textNodes) {
    const text = node.textContent ?? "";
    const start = fullRaw.length;
    fullRaw += text;
    const end = fullRaw.length;
    nodeRanges.push({ node, start, end });
  }

  const isP = el.tagName.toLowerCase() === "p";
  const chunkRange = getChunkRangeInFullRaw(fullRaw, chunkIndex, isP);
  if (!chunkRange) return false;

  const globalStart = chunkRange.start + rawStart;
  const globalEnd = chunkRange.start + rawEnd;

  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  for (const { node, start, end } of nodeRanges) {
    if (start <= globalStart && globalStart <= end) {
      startNode = node;
      startOffset = globalStart - start;
    }
    if (start <= globalEnd && globalEnd <= end) {
      endNode = node;
      endOffset = globalEnd - start;
    }
  }
  if (!startNode || !endNode) return false;

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);

  const span = document.createElement("span");
  const confidence = instruction.confidence ?? 0;
  span.setAttribute(GLOSS_MARKER_ATTR, instruction.id);
  span.setAttribute(GLOSS_SOURCE_ATTR, instruction.sourceText.slice(instruction.start, instruction.end));
  span.setAttribute("data-gloss-confidence", String(confidence));
  span.setAttribute("data-gloss-reinforcement", instruction.isReinforcement ? "true" : "false");
  span.className = GLOSS_WRAPPER_CLASS;
  span.textContent = instruction.replacementText;
  span.style.setProperty("--gloss-confidence", String(confidence));

  try {
    range.deleteContents();
    range.insertNode(span);
  } catch {
    return false;
  }
  console.log(
    `[GlossPlusOne:renderer] Wrapped span at offsets ${instruction.start}-${instruction.end}`,
  );
  return true;
}

/**
 * Apply all replacement instructions. Applies in order; skips already-rendered and invalid.
 */
export function applyOutput(instructions: ReplacementInstruction[]): void {
  for (const inst of instructions) {
    applyReplacement(inst);
  }
}
