import { describe, expect, it } from "vitest";
import { detectDomainAndType } from "@/content/reader/domainDetect";
import { loadFixture, setDocument } from "./helpers/dom";

describe("detectDomainAndType", () => {
  it("classifies known domains from url patterns", () => {
    setDocument(loadFixture("news.html"));
    expect(
      detectDomainAndType({ url: "https://www.cbc.ca/news/politics/story", document }).pageType,
    ).toBe("news");
    expect(
      detectDomainAndType({ url: "https://en.wikipedia.org/wiki/Transformer_(deep_learning)", document })
        .pageType,
    ).toBe("wiki");
    expect(detectDomainAndType({ url: "https://medium.com/@a/post", document }).pageType).toBe("blog");
    expect(
      detectDomainAndType({ url: "https://www.reddit.com/r/programming/comments/abc", document }).pageType,
    ).toBe("social");
    expect(detectDomainAndType({ url: "https://university.edu/paper", document }).pageType).toBe("academic");
  });

  it("detects english language", () => {
    setDocument(loadFixture("blog.html"));
    const out = detectDomainAndType({ url: "https://example.com/post", document });
    expect(out.language).toBe("en");
  });
});

