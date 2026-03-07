import { detectDomainAndType } from "./domainDetect";
import { extractParagraphs } from "./parser";
import type { PageContent } from "./types";

export function enrichPageContent(documentRef: Document = document): PageContent {
  const url = window.location.href;
  const title = documentRef.title ?? "";
  const paragraphs = extractParagraphs({ root: documentRef });
  const totalWordCount = paragraphs.reduce((sum, p) => sum + p.wordCount, 0);
  const domainMeta = detectDomainAndType({ url, document: documentRef });

  return {
    url,
    title,
    domain: domainMeta.domain,
    pageType: domainMeta.pageType,
    language: domainMeta.language,
    paragraphs,
    totalWordCount,
    extractedAt: Date.now(),
  };
}

