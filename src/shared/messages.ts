import type { BankPhrase, ProgressionConfig } from "@/shared/types";

export interface SerializableParagraph {
  index: number;
  text: string;
  wordCount: number;
  domPath: string;
  readingOrder: number;
}

export type TriggerPlannerReason =
  | "initial"
  | "progression"
  | "debug_increment"
  | "debug_decrement";

export interface GetBankMessage {
  type: "GET_BANK";
  payload: { language: string };
}

export interface BankReadyMessage {
  type: "BANK_READY";
  payload: BankPhrase[];
}

export interface RecordExposureMessage {
  type: "RECORD_EXPOSURE";
  payload: {
    phraseId: string;
    url: string;
    title: string;
    language: string;
  };
}

export interface RecordHoverDecayMessage {
  type: "RECORD_HOVER_DECAY";
  payload: {
    phraseId: string;
    language: string;
  };
}

export interface CheckProgressionMessage {
  type: "CHECK_PROGRESSION";
  payload: {
    language: string;
  };
}

export interface TriggerPlannerMessage {
  type: "TRIGGER_PLANNER";
  payload: {
    reason: TriggerPlannerReason;
    language: string;
  };
}

export interface FetchDefinitionMessage {
  type: "FETCH_DEFINITION";
  payload: {
    phraseId: string;
    foreignPhrase: string;
    originalPhrase: string;
    language: string;
  };
}

export interface UpdateProgressionConfigMessage {
  type: "UPDATE_PROGRESSION_CONFIG";
  payload: Partial<ProgressionConfig>;
}

export type ContentToBackgroundMessage =
  | GetBankMessage
  | RecordExposureMessage
  | RecordHoverDecayMessage
  | CheckProgressionMessage
  | TriggerPlannerMessage
  | FetchDefinitionMessage
  | UpdateProgressionConfigMessage;

/** Single replacement target: one phrase within a paragraph identified by domPath. */
export interface ReplacementInstruction {
  id: string;
  phraseId: string;
  domPath: string;
  /** Paragraph text as extracted (used to match and compute offsets). */
  sourceText: string;
  /** Display text to show in place of the phrase. */
  replacementText: string;
  /** Start offset in sourceText (inclusive). */
  start: number;
  /** End offset in sourceText (exclusive). */
  end: number;
  targetLanguage: string;
  phraseType: "structural" | "lexical";
  confidence?: number;
  isReinforcement?: boolean;
}

export type BackgroundToContentMessage = BankReadyMessage;
