export type PageType = "news" | "blog" | "academic" | "wiki" | "social" | "unknown";

export interface ExtractedParagraph {
  index: number;
  text: string;
  wordCount: number;
  nodeRef: WeakRef<Element> | null;
  domPath: string;
  readingOrder: number;
}

export interface PageContent {
  url: string;
  title: string;
  domain: string;
  pageType: PageType;
  language: string;
  paragraphs: ExtractedParagraph[];
  totalWordCount: number;
  extractedAt: number;
}

