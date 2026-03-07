import { describe, expect, it } from "vitest";
import { enrichPageContent } from "@/content/reader/enricher";
import { loadFixture, setDocument } from "./helpers/dom";

describe("enrichPageContent", () => {
  it("builds full page content object", () => {
    setDocument(loadFixture("wiki.html"));
    const content = enrichPageContent(document);
    expect(content.url).toBeTypeOf("string");
    expect(content.title).toBeTypeOf("string");
    expect(content.domain).toBeTypeOf("string");
    expect(content.pageType).toBeTypeOf("string");
    expect(content.language).toBeTypeOf("string");
    expect(Array.isArray(content.paragraphs)).toBe(true);
    expect(content.totalWordCount).toBe(
      content.paragraphs.reduce((sum, p) => sum + p.wordCount, 0),
    );
    expect(content.extractedAt).toBeTypeOf("number");
  });
});

