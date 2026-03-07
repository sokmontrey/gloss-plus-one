import { describe, expect, it } from "vitest";
import { enrichPageContent } from "@/content/reader/enricher";
import { loadFixture, setDocument } from "./helpers/dom";

describe("extraction pipeline e2e", () => {
  it("extracts content without pulling navigation text", () => {
    setDocument(loadFixture("noise-heavy.html"));
    const before = document.documentElement.outerHTML.length;
    const content = enrichPageContent(document);
    const after = document.documentElement.outerHTML.length;

    expect(content.paragraphs.length).toBeGreaterThan(0);
    expect(content.paragraphs.map((p) => p.text).join(" ").toLowerCase()).not.toContain("home | news");
    expect(before).toBe(after);
  });
});

