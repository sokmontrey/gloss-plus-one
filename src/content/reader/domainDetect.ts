import type { PageType } from "./types";

const EN_STOPWORDS = new Set(["the", "and", "of", "to", "in", "is", "for", "that", "with", "on"]);

function getHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function detectLanguage(document: Document): string {
  const lang = document.documentElement.lang?.toLowerCase() ?? "";
  if (lang.startsWith("en")) return "en";

  const ogLocale = document
    .querySelector("meta[property='og:locale']")
    ?.getAttribute("content")
    ?.toLowerCase();
  if (ogLocale?.startsWith("en_")) return "en";

  const text = (document.body?.innerText ?? "").slice(0, 1500).toLowerCase();
  const words = text.match(/\b[a-z]+\b/g) ?? [];
  if (words.length < 50) return "unknown";
  const hits = words.filter((w) => EN_STOPWORDS.has(w)).length;
  return hits / words.length > 0.08 ? "en" : "unknown";
}

export function detectDomainAndType(input: {
  url: string;
  document: Document;
}): { domain: string; pageType: PageType; language: string } {
  const host = getHost(input.url);
  let pageType: PageType = "unknown";

  if (host.includes("wikipedia.org")) pageType = "wiki";
  else if (host.endsWith(".edu")) pageType = "academic";
  else if (host.includes("medium.com") || host.includes("substack.com")) pageType = "blog";
  else if (host.includes("reddit.com") || host.includes("x.com")) pageType = "social";
  else if (
    host.includes("cbc.ca") ||
    host.includes("nytimes.com") ||
    host.includes("bbc.com") ||
    host.includes("reuters.com")
  ) {
    pageType = "news";
  } else if (input.document.querySelector("article")) {
    pageType = "blog";
  } else if (input.document.querySelector("main")) {
    pageType = "unknown";
  }

  return {
    domain: host,
    pageType,
    language: detectLanguage(input.document),
  };
}

