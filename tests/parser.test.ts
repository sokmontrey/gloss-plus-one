import { describe, expect, it } from "vitest";
import { extractParagraphs } from "@/content/reader/parser";
import { loadFixture, setDocument } from "./helpers/dom";

describe("extractParagraphs", () => {
  it("extracts reading paragraphs in order", () => {
    setDocument(loadFixture("news.html"));
    const rows = extractParagraphs();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((row, index) => row.index === index)).toBe(true);
    expect(rows.every((row) => row.wordCount >= 20)).toBe(true);
  });

  it("does not extract nav/footer from noisy fixture", () => {
    setDocument(loadFixture("noise-heavy.html"));
    const rows = extractParagraphs();
    const merged = rows.map((r) => r.text.toLowerCase()).join(" ");
    expect(merged.includes("home | news")).toBe(false);
    expect(merged.includes("terms privacy cookies")).toBe(false);
  });
});

