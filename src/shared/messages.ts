import type { PageContent, ReplacementPlan } from "@/shared/types";

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

export interface PlanReadyMessage {
  type: "PLAN_READY";
  payload: ReplacementPlan[];
}

export type BackgroundToContentMessage = PlanReadyMessage;

