export type { ExtractedParagraph, PageContent, PageType } from "@/content/reader/types";

export interface ArticleContext {
  topic: string;
  register: "formal" | "informal" | "academic" | "casual";
  vocabularyDomain: string;
  estimatedReadingLevel: string;
}

export interface UserContext {
  cefrBand: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  cefrConfidence: number;
  targetLanguage: "es" | "fr" | "de" | "pt" | "it";
  nativeLanguage: string;
  knownPhrases: string[];
  immersionIntensity: number;
  sessionFatigueSignal: boolean;
  sessionDepth: number;
  phraseState: LearnerPhraseState;
  /** 0–1: confidence cutoff for when to start introducing the next phrase step. Higher = wait longer. */
  progressionThreshold: number;
  /** 0–1: debug override. 0 = nothing, 1 = everything (basics known, exploration mode). Persisted. */
  debugLearnerLevel: number;
}

export interface BankPhrase {
  id: string;
  phrase: string;
  targetPhrase: string;
  targetLanguage: string;
  nativeLanguage: string;
  phraseType: "structural" | "lexical";
  tier: number;
  addedAt: number;
  addedByBatch: string;
  confidence: number;
  exposures: number;
  hoverCount: number;
  lastSeenAt: number;
  firstSeenUrl: string;
  firstSeenTitle: string;
}

export interface PhraseBatch {
  id: string;
  addedAt: number;
  tier: number;
  triggerReason: "initial" | "progression" | "debug_increment" | "debug_decrement" | "manual";
  phraseCount: number;
  plannerContext: string;
}

export interface PhraseBank {
  phrases: BankPhrase[];
  language: string;
  currentTier: number;
  lastPlannerRunAt: number;
  lastBatchId: string;
  batches: PhraseBatch[];
}

export interface ProgressionConfig {
  progressionThreshold: number;
  confidenceGainPerExposure: number;
  confidenceDecayPerHover: number;
  hoverDecayThresholdMs: number;
}

export interface PageSignal {
  id: string;
  url: string;
  title: string;
  domain: string;
  pageType: string;
  topic: string | null;
  contentSnippet: string;
  replacementCount: number;
  visitedAt: number;
}

export interface UserInterestProfile {
  topTopics: string[];
  topDomains: string[];
  recentTopics: string[];
  lastUpdatedAt: number;
}

export interface ManualBankEntry {
  id: string;
  phrase: string;
  targetPhrase: string;
  targetLanguage: string;
  nativeLanguage: string;
  sourceUrl: string;
  sourceTitle: string;
  addedAt: number;
  userSelected: true;
}

export interface PlannedReplacement {
  targetPhrase: string;
  foreignPhrase: string;
  translation: string;
  targetLanguage: string;
  difficultyLevel: number;
  replacementType: "vocabulary" | "phrase" | "grammar_structure";
  pedagogicalReason: string;
  paragraphIndex: number;
  caseSensitive: boolean;
  confidence?: number;
  isReinforcement?: boolean;
}

export interface PhraseMemory {
  phrase: string;
  targetPhrase: string;
  targetLanguage: string;
  phraseType: "structural" | "lexical";
  confidence: number;
  exposures: number;
  reveals: number;
  passedCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
  firstSeenUrl: string;
  firstSeenTitle: string;
}

export interface LearnerPhraseState {
  seenPhrases: PhraseMemory[];
  pendingIntroductions: {
    phrase: string;
    targetPhrase: string;
    targetLanguage: string;
    phraseType: "structural" | "lexical";
    introducedAt: number;
  }[];
  totalSessionCount: number;
  lastSessionAt: number;
}

export interface ReplacementBudget {
  totalBudget: number;
  perParagraph: Record<number, number>;
  maxPhrasesPerParagraph: number;
  maxConsecutiveReplaced: number;
}

export interface ReplacementManifest {
  articleContext: ArticleContext;
  userContext: UserContext;
  budget: ReplacementBudget;
  replacements: PlannedReplacement[];
  generatedAt: number;
  modelUsed: string;
}

export interface ReplacementPlan {
  paragraphIndex: number;
  originalText: string;
  replacements: PlannedReplacement[];
}
