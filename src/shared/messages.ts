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

export type BankReadyReason = TriggerPlannerReason | "manual" | "bank_sync";

export interface GetBankMessage {
  type: "GET_BANK";
  payload: { language: string };
}

export interface BankReadyMessage {
  type: "BANK_READY";
  payload: {
    language: string;
    phrases: BankPhrase[];
    currentTier: number;
    lastBatchId: string;
    reason: BankReadyReason;
  };
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

export interface EnsureStructuralTranslationsMessage {
  type: "ENSURE_STRUCTURAL_TRANSLATIONS";
  payload: {
    language: string;
  };
}

export interface RunPageDiscoveryMessage {
  type: "RUN_PAGE_DISCOVERY";
  payload: {
    pageText: string;
    pageTitle: string;
    pageUrl: string;
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

export interface ResetLanguageDataMessage {
  type: "RESET_LANGUAGE_DATA";
  payload: {
    language: string;
  };
}

export interface RequestAudioMessage {
  type: "REQUEST_AUDIO";
  payload: {
    text: string;
    language: string;
  };
}

export interface AudioReadyMessage {
  type: "AUDIO_READY";
  payload: {
    text: string;
    dataUri: string;
  };
}

export interface ReportPageSignalMessage {
  type: "REPORT_PAGE_SIGNAL";
  payload: {
    url: string;
    title: string;
    domain: string;
    pageType: string;
    contentSnippet: string;
    replacementCount: number;
  };
}

export interface AddPhraseToBankMessage {
  type: "ADD_PHRASE_TO_BANK";
  payload: {
    phrase: string;
    language: string;
    sourceUrl: string;
    sourceTitle: string;
  };
}

export interface AssessTranslationMessage {
  type: "ASSESS_TRANSLATION";
  payload: {
    phrase: string;
    userTranslation: string;
    language: string;
  };
}

export interface GetPageStatusMessage {
  type: "GET_PAGE_STATUS";
}

export interface RunPageDiscoveryNowMessage {
  type: "RUN_PAGE_DISCOVERY_NOW";
}

export interface RefreshReplacementsMessage {
  type: "REFRESH_REPLACEMENTS";
}

export interface CurrentPageStatus {
  url: string;
  disabled: boolean;
}

export type ContentToBackgroundMessage =
  | GetBankMessage
  | RecordExposureMessage
  | RecordHoverDecayMessage
  | CheckProgressionMessage
  | TriggerPlannerMessage
  | EnsureStructuralTranslationsMessage
  | RunPageDiscoveryMessage
  | FetchDefinitionMessage
  | UpdateProgressionConfigMessage
  | ResetLanguageDataMessage
  | RequestAudioMessage
  | ReportPageSignalMessage
  | AddPhraseToBankMessage
  | AssessTranslationMessage;

export type PopupToContentMessage =
  | GetPageStatusMessage
  | RunPageDiscoveryNowMessage
  | RefreshReplacementsMessage;

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

export type BackgroundToContentMessage = BankReadyMessage | AudioReadyMessage;
