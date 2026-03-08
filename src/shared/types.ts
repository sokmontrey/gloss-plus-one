export type { ExtractedParagraph, PageContent, PageType } from "@/content/reader/types";

export interface ArticleContext {
  topic: string;
  register: "formal" | "informal" | "academic" | "casual";
  vocabularyDomain: string;
  estimatedReadingLevel: string;
}

export interface AssessmentHistoryEntry {
  id: string;
  phrase: string;
  userTranslation: string;
  score: number;
  timestamp: number;
}

export interface DisplayConfig {
  /** Primary hue (0–360) for replacement highlights */
  highlightHue: number;
  /** High-confidence opacity (0–1). Controls "bright" highlight intensity */
  highlightIntensityHigh: number;
  /** Low-confidence opacity (0–1). Controls "dim" highlight intensity */
  highlightIntensityLow: number;
  /** Whether to show underline on replacements */
  showUnderline: boolean;
  /** Whether to show the entry animation */
  showEntryAnimation: boolean;
  /** Whether structural phrases are bold */
  boldStructural: boolean;
  /** Whether lexical phrases are italic */
  italicLexical: boolean;
}

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  highlightHue: 43,
  highlightIntensityHigh: 0.2,
  highlightIntensityLow: 0.01,
  showUnderline: true,
  showEntryAnimation: true,
  boldStructural: true,
  italicLexical: true,
};

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
  assessmentScore?: number;
  assessmentHistory?: AssessmentHistoryEntry[];
  badges?: string[];
  displayConfig?: DisplayConfig;
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
  progressionTriggeredAt?: number;
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
