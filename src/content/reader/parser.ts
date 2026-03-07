import { buildDomPath } from "./domPath";
import { isReadableParagraph } from "./parser/filter";
import { selectCandidateElements } from "./parser/selector";
import type { ExtractedParagraph } from "./types";

function splitTextIntoParagraphs(element: Element): string[] {
  if (element.tagName.toLowerCase() === "p") {
    const text = (element.textContent ?? "").trim();
    return text ? [text] : [];
  }

  const text = (element.textContent ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n\s*\n/g)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return text;
}

export interface ExtractOptions {
  root?: ParentNode;
}

export function extractParagraphs(options: ExtractOptions = {}): ExtractedParagraph[] {
  const candidates = selectCandidateElements({ root: options.root });
  const rows: ExtractedParagraph[] = [];

  for (const candidate of candidates) {
    const path = buildDomPath(candidate);
    const chunks = splitTextIntoParagraphs(candidate);
    for (const chunk of chunks) {
      if (!isReadableParagraph(chunk)) continue;
      rows.push({
        index: rows.length,
        text: chunk,
        wordCount: (chunk.match(/\b[\p{L}]+(?:['’-][\p{L}]+)*\b/gu) ?? []).length,
        nodeRef: new WeakRef(candidate),
        domPath: path,
        readingOrder: rows.length,
      });
    }
  }

  return rows;
}

