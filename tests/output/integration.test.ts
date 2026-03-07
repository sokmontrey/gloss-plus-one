import { describe, expect, it } from "vitest";
import { enrichPageContent } from "@/content/reader/enricher";
import { applyOutput } from "@/content/output/renderer";
import { loadFixture, setDocument } from "../helpers/dom";
import type { ReplacementInstruction } from "@/shared/messages";
import { GLOSS_MARKER_ATTR } from "@/content/output/types";

/** Build mock replacements from first words of first paragraphs (like background). Uses normalized text. */
function buildMockReplacements(paragraphs: Array<{ text: string; domPath: string }>): ReplacementInstruction[] {
  const wordRe = /\b[\p{L}]+(?:[''-][\p{L}]+)*\b/gu;
  const out: ReplacementInstruction[] = [];
  let id = 0;
  for (const p of paragraphs.slice(0, 2)) {
    const normalized = p.text.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const match = wordRe.exec(normalized);
    if (!match) continue;
    const start = match.index;
    const end = start + match[0].length;
    out.push({
      id: `int-mock-${id++}`,
      domPath: p.domPath,
      sourceText: normalized,
      replacementText: match[0],
      start,
      end,
    });
  }
  return out;
}

describe("output integration", () => {
  it("extraction plus mock output applies replacements without mutating unrelated content", () => {
    setDocument(loadFixture("news.html"));
    const beforeHtml = document.documentElement.outerHTML;

    const content = enrichPageContent(document);
    expect(content.paragraphs.length).toBeGreaterThan(0);

    const instructions = buildMockReplacements(
      content.paragraphs.map((p) => ({ text: p.text, domPath: p.domPath }))
    );
    expect(instructions.length).toBeGreaterThan(0);

    applyOutput(instructions);

    const main = document.querySelector("main");
    expect(main).toBeTruthy();
    const wrappers = main!.querySelectorAll(`[${GLOSS_MARKER_ATTR}]`);
    expect(wrappers.length).toBe(instructions.length);

    const firstParagraphText = content.paragraphs[0].text;
    expect(firstParagraphText).toContain("federal");
    expect(document.body.textContent).toContain("federal");

    const afterHtml = document.documentElement.outerHTML;
    expect(afterHtml.length).toBeGreaterThan(beforeHtml.length);
  });

  it("re-running extraction after output still sees paragraph text (no duplicate wrappers)", () => {
    setDocument(loadFixture("news.html"));
    const content1 = enrichPageContent(document);
    expect(content1.paragraphs.length).toBeGreaterThan(0);
    const para = content1.paragraphs[0];
    const normalized = para.text.replace(/\s+/g, " ").trim();
    const wordRe = /\b[\p{L}]+(?:[''-][\p{L}]+)*\b/gu;
    const match = wordRe.exec(normalized);
    expect(match).toBeTruthy();
    const start = match!.index;
    const end = start + match![0].length;

    applyOutput([
      {
        id: "once",
        domPath: para.domPath,
        sourceText: normalized,
        replacementText: match![0],
        start,
        end,
      },
    ]);

    const content2 = enrichPageContent(document);
    expect(content2.paragraphs.length).toBeGreaterThan(0);
    expect(content2.paragraphs[0].text).toContain(match![0]);
  });
});
