import { describe, expect, it } from "vitest";
import { selectCandidateElements } from "@/content/reader/parser/selector";
import { loadFixture, setDocument } from "./helpers/dom";

describe("selectCandidateElements", () => {
  it("excludes navigation and footer regions", () => {
    setDocument(loadFixture("noise-heavy.html"));
    const elements = selectCandidateElements({ minWordCount: 10 });
    const texts = elements.map((el) => (el.textContent ?? "").toLowerCase());
    expect(texts.some((t) => t.includes("home | news"))).toBe(false);
    expect(texts.some((t) => t.includes("terms privacy cookies"))).toBe(false);
  });

  it("returns body-content elements from article pages", () => {
    setDocument(loadFixture("news.html"));
    const elements = selectCandidateElements({ minWordCount: 20 });
    expect(elements.length).toBeGreaterThan(0);
    expect(elements.some((el) => el.tagName.toLowerCase() === "article")).toBe(true);
  });
});

