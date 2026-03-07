import { describe, expect, it } from "vitest";
import { buildDomPath, resolveDomPath } from "@/content/reader/domPath";
import { loadFixture, setDocument } from "./helpers/dom";

describe("domPath", () => {
  it("round-trips selected elements", () => {
    setDocument(loadFixture("news.html"));
    const nodes = Array.from(document.querySelectorAll("*")).slice(0, 50);
    for (const node of nodes) {
      const path = buildDomPath(node);
      expect(resolveDomPath(path)).toBe(node);
    }
  });
});

