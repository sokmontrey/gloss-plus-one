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

export interface WordSignalMessage {
  type: "WORD_SIGNAL";
  payload: {
    phrase: string;
    foreignPhrase: string;
    targetLanguage: string;
    phraseType: "structural" | "lexical";
    signal: "exposure" | "reveal" | "pass";
    dwellMs: number;
    url: string;
    title: string;
  };
}

export interface ResetPhrasesMessage {
  type: "RESET_PHRASES";
}

export type ContentToBackgroundMessage =
  | PageLoadedMessage
  | RequestPlanMessage
  | WordSignalMessage
  | ResetPhrasesMessage;

export interface PlanReadyMessage {
  type: "PLAN_READY";
  payload: ReplacementPlan[];
}

/** Single replacement target: one phrase within a paragraph identified by domPath. */
export interface ReplacementInstruction {
  id: string;
  domPath: string;
  /** Paragraph text as extracted (used to match and compute offsets). */
  sourceText: string;
  /** Display text to show in place of the phrase. */
  replacementText: string;
  /** Start offset in sourceText (inclusive). */
  start: number;
  /** End offset in sourceText (exclusive). */
  end: number;
  confidence?: number;
  isReinforcement?: boolean;
}

export interface ApplyOutputMessage {
  type: "APPLY_OUTPUT";
  payload: ReplacementInstruction[];
}

export type BackgroundToContentMessage = PlanReadyMessage | ApplyOutputMessage;
