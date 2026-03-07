import { describe, expect, it } from "vitest";
import { applyReplacement, applyOutput } from "@/content/output/renderer";
import { buildDomPath } from "@/content/reader/domPath";
import { enrichPageContent } from "@/content/reader/enricher";
import { loadFixture, setDocument } from "../helpers/dom";
import type { ReplacementInstruction } from "@/shared/messages";
import { GLOSS_MARKER_ATTR, GLOSS_SOURCE_ATTR, GLOSS_WRAPPER_CLASS } from "@/content/output/types";

function instruction(
  overrides: Partial<ReplacementInstruction> & { id: string; domPath: string; sourceText: string }
): ReplacementInstruction {
  const text = overrides.sourceText;
  const start = overrides.start ?? 0;
  const end = overrides.end ?? text.length;
  return {
    id: overrides.id,
    domPath: overrides.domPath,
    sourceText: text,
    replacementText: overrides.replacementText ?? text.slice(start, end),
    start,
    end,
  };
}

describe("output renderer", () => {
  it("wraps only the intended substring within the target element", () => {
    setDocument(loadFixture("single-p.html"));
    const p = document.querySelector("p#single")!;
    const path = buildDomPath(p);
    const sourceText = (p.textContent ?? "").replace(/\s+/g, " ").trim();
    const word = "quick";
    const start = sourceText.indexOf(word);
    const end = start + word.length;

    const inst = instruction({
      id: "wrap-quick",
      domPath: path,
      sourceText,
      replacementText: word,
      start,
      end,
    });

    const ok = applyReplacement(inst);
    expect(ok).toBe(true);

    const span = p.querySelector(`[${GLOSS_MARKER_ATTR}="wrap-quick"]`);
    expect(span).toBeTruthy();
    expect(span?.tagName).toBe("SPAN");
    expect(span?.className).toContain(GLOSS_WRAPPER_CLASS);
    expect(span?.getAttribute(GLOSS_SOURCE_ATTR)).toBe("quick");
    expect(span?.textContent).toBe("quick");
    expect(p.textContent).toContain("The quick brown fox");
  });

  it("re-applying the same instruction does not double-wrap (idempotency)", () => {
    setDocument(loadFixture("single-p.html"));
    const p = document.querySelector("p#single")!;
    const path = buildDomPath(p);
    const sourceText = (p.textContent ?? "").replace(/\s+/g, " ").trim();
    const word = "fox";
    const start = sourceText.indexOf(word);
    const end = start + word.length;

    const inst = instruction({
      id: "wrap-fox",
      domPath: path,
      sourceText,
      replacementText: word,
      start,
      end,
    });

    applyReplacement(inst);
    applyReplacement(inst);

    const spans = p.querySelectorAll(`[${GLOSS_MARKER_ATTR}="wrap-fox"]`);
    expect(spans.length).toBe(1);
  });

  it("applyOutput applies all instructions", () => {
    setDocument(loadFixture("single-p.html"));
    const p = document.querySelector("p#single")!;
    const path = buildDomPath(p);
    const sourceText = (p.textContent ?? "").replace(/\s+/g, " ").trim();
    const quickStart = sourceText.indexOf("quick");
    const foxStart = sourceText.indexOf("fox");

    const instructions: ReplacementInstruction[] = [
      instruction({
        id: "a",
        domPath: path,
        sourceText,
        replacementText: "quick",
        start: quickStart,
        end: quickStart + 5,
      }),
      instruction({
        id: "b",
        domPath: path,
        sourceText,
        replacementText: "fox",
        start: foxStart,
        end: foxStart + 3,
      }),
    ];

    applyOutput(instructions);

    expect(p.querySelector(`[${GLOSS_MARKER_ATTR}="a"]`)?.textContent).toBe("quick");
    expect(p.querySelector(`[${GLOSS_MARKER_ATTR}="b"]`)?.textContent).toBe("fox");
  });
});
