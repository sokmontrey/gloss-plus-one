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
