import type { PageContent } from "@/content/reader/types";

export interface SerializableParagraph {
  index: number;
  text: string;
  wordCount: number;
  domPath: string;
  readingOrder: number;
}

export interface SerializablePageContent extends Omit<PageContent, "paragraphs"> {
  paragraphs: SerializableParagraph[];
}

export interface PageLoadedMessage {
  type: "PAGE_LOADED";
  url: string;
  title: string;
  at: number;
}

export interface RequestPlanMessage {
  type: "REQUEST_PLAN";
  trigger: "initial" | "mutation";
  payload: SerializablePageContent;
}

export type ContentToBackgroundMessage = PageLoadedMessage | RequestPlanMessage;

