import type { LearnerPhraseState, PhraseMemory } from "@/shared/types";

const STORAGE_KEY = "glossPhraseState";

const DEFAULT_PHRASE_STATE: LearnerPhraseState = {
  seenPhrases: [],
  pendingIntroductions: [],
  totalSessionCount: 0,
  lastSessionAt: 0,
};

export async function getPhraseState(): Promise<LearnerPhraseState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as LearnerPhraseState | undefined) ?? { ...DEFAULT_PHRASE_STATE };
}

export async function savePhraseState(state: LearnerPhraseState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

/** Clears all learned phrases and resets phrase state to default. */
export async function resetPhraseState(): Promise<void> {
  await savePhraseState({ ...DEFAULT_PHRASE_STATE });
  console.log("[GlossPlusOne:phraseStore] Phrase state reset");
}

export async function recordPhraseExposure(
  phrase: string,
  targetPhrase: string,
  targetLanguage: string,
  phraseType: "structural" | "lexical",
  url: string,
  title: string,
): Promise<void> {
  const state = await getPhraseState();
  const existing = state.seenPhrases.find(
    (entry) =>
      entry.phrase.toLowerCase() === phrase.toLowerCase() && entry.targetLanguage === targetLanguage,
  );

  if (existing) {
    existing.exposures += 1;
    existing.lastSeenAt = Date.now();
    existing.confidence = Math.min(existing.confidence + 0.02, 1.0);
  } else {
    state.seenPhrases.push({
      phrase,
      targetPhrase,
      targetLanguage,
      phraseType,
      confidence: 0.0,
      exposures: 1,
      reveals: 0,
      passedCount: 0,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      firstSeenUrl: url,
      firstSeenTitle: title,
    });
  }

  await savePhraseState(state);
}

export async function recordPhraseReveal(
  phrase: string,
  targetLanguage: string,
): Promise<void> {
  const state = await getPhraseState();
  const existing = state.seenPhrases.find(
    (entry) =>
      entry.phrase.toLowerCase() === phrase.toLowerCase() && entry.targetLanguage === targetLanguage,
  );
  if (!existing) return;

  existing.reveals += 1;
  existing.confidence = Math.max(existing.confidence - 0.12, 0.0);
  await savePhraseState(state);
}

export async function recordPhrasePassed(
  phrase: string,
  targetLanguage: string,
): Promise<void> {
  const state = await getPhraseState();
  const existing = state.seenPhrases.find(
    (entry) =>
      entry.phrase.toLowerCase() === phrase.toLowerCase() && entry.targetLanguage === targetLanguage,
  );
  if (!existing) return;

  existing.passedCount += 1;
  existing.confidence = Math.min(existing.confidence + 0.05, 1.0);
  await savePhraseState(state);
}

export async function getPhraseConfidence(
  phrase: string,
  targetLanguage: string,
): Promise<number | null> {
  const state = await getPhraseState();
  const found = state.seenPhrases.find(
    (entry) =>
      entry.phrase.toLowerCase() === phrase.toLowerCase() && entry.targetLanguage === targetLanguage,
  );
  return found ? found.confidence : null;
}

export async function getSeenPhrasesForLanguage(language: string): Promise<PhraseMemory[]> {
  const state = await getPhraseState();
  return state.seenPhrases.filter((entry) => entry.targetLanguage === language);
}

/**
 * Returns seen phrases for a language with confidence blended by debug learner level.
 * debugLearnerLevel 0 = use real confidence; 1 = treat all as fully known (confidence 1).
 * Use this in the planner when userContext.debugLearnerLevel is set.
 */
export async function getEffectiveSeenPhrasesForLanguage(
  language: string,
  debugLearnerLevel: number,
): Promise<PhraseMemory[]> {
  const raw = await getSeenPhrasesForLanguage(language);
  const level = Math.max(0, Math.min(1, debugLearnerLevel));
  if (level === 0) return raw;
  return raw.map((entry) => ({
    ...entry,
    confidence: entry.confidence * (1 - level) + level,
  }));
}

/** Foundational structural/lexical phrases per language: phrase -> targetPhrase. Used when debug level is "everything". */
const FOUNDATIONAL_BY_LANGUAGE: Record<string, Array<{ phrase: string; targetPhrase: string; phraseType: "structural" | "lexical" }>> = {
  es: [
    { phrase: "this is", targetPhrase: "esto es", phraseType: "structural" },
    { phrase: "that is", targetPhrase: "eso es", phraseType: "structural" },
    { phrase: "there is", targetPhrase: "hay", phraseType: "structural" },
    { phrase: "there are", targetPhrase: "hay", phraseType: "structural" },
    { phrase: "it is", targetPhrase: "es", phraseType: "structural" },
    { phrase: "what is", targetPhrase: "qué es", phraseType: "structural" },
    { phrase: "how does", targetPhrase: "cómo", phraseType: "structural" },
    { phrase: "however", targetPhrase: "sin embargo", phraseType: "structural" },
    { phrase: "therefore", targetPhrase: "por lo tanto", phraseType: "structural" },
    { phrase: "because of", targetPhrase: "debido a", phraseType: "structural" },
    { phrase: "in order to", targetPhrase: "para", phraseType: "structural" },
    { phrase: "time", targetPhrase: "tiempo", phraseType: "lexical" },
    { phrase: "people", targetPhrase: "gente", phraseType: "lexical" },
    { phrase: "work", targetPhrase: "trabajo", phraseType: "lexical" },
    { phrase: "important", targetPhrase: "importante", phraseType: "lexical" },
  ],
  fr: [
    { phrase: "this is", targetPhrase: "c'est", phraseType: "structural" },
    { phrase: "that is", targetPhrase: "c'est", phraseType: "structural" },
    { phrase: "there is", targetPhrase: "il y a", phraseType: "structural" },
    { phrase: "there are", targetPhrase: "il y a", phraseType: "structural" },
    { phrase: "it is", targetPhrase: "c'est", phraseType: "structural" },
    { phrase: "what is", targetPhrase: "qu'est-ce que", phraseType: "structural" },
    { phrase: "however", targetPhrase: "cependant", phraseType: "structural" },
    { phrase: "therefore", targetPhrase: "donc", phraseType: "structural" },
    { phrase: "because of", targetPhrase: "à cause de", phraseType: "structural" },
    { phrase: "time", targetPhrase: "temps", phraseType: "lexical" },
    { phrase: "people", targetPhrase: "gens", phraseType: "lexical" },
    { phrase: "work", targetPhrase: "travail", phraseType: "lexical" },
    { phrase: "important", targetPhrase: "important", phraseType: "lexical" },
  ],
  de: [
    { phrase: "this is", targetPhrase: "das ist", phraseType: "structural" },
    { phrase: "that is", targetPhrase: "das ist", phraseType: "structural" },
    { phrase: "there is", targetPhrase: "es gibt", phraseType: "structural" },
    { phrase: "it is", targetPhrase: "es ist", phraseType: "structural" },
    { phrase: "what is", targetPhrase: "was ist", phraseType: "structural" },
    { phrase: "however", targetPhrase: "jedoch", phraseType: "structural" },
    { phrase: "therefore", targetPhrase: "daher", phraseType: "structural" },
    { phrase: "time", targetPhrase: "Zeit", phraseType: "lexical" },
    { phrase: "people", targetPhrase: "Leute", phraseType: "lexical" },
    { phrase: "work", targetPhrase: "Arbeit", phraseType: "lexical" },
    { phrase: "important", targetPhrase: "wichtig", phraseType: "lexical" },
  ],
  pt: [
    { phrase: "this is", targetPhrase: "isto é", phraseType: "structural" },
    { phrase: "that is", targetPhrase: "isso é", phraseType: "structural" },
    { phrase: "there is", targetPhrase: "há", phraseType: "structural" },
    { phrase: "there are", targetPhrase: "há", phraseType: "structural" },
    { phrase: "it is", targetPhrase: "é", phraseType: "structural" },
    { phrase: "however", targetPhrase: "no entanto", phraseType: "structural" },
    { phrase: "therefore", targetPhrase: "portanto", phraseType: "structural" },
    { phrase: "time", targetPhrase: "tempo", phraseType: "lexical" },
    { phrase: "people", targetPhrase: "pessoas", phraseType: "lexical" },
    { phrase: "work", targetPhrase: "trabalho", phraseType: "lexical" },
    { phrase: "important", targetPhrase: "importante", phraseType: "lexical" },
  ],
  it: [
    { phrase: "this is", targetPhrase: "questo è", phraseType: "structural" },
    { phrase: "that is", targetPhrase: "quello è", phraseType: "structural" },
    { phrase: "there is", targetPhrase: "c'è", phraseType: "structural" },
    { phrase: "there are", targetPhrase: "ci sono", phraseType: "structural" },
    { phrase: "it is", targetPhrase: "è", phraseType: "structural" },
    { phrase: "however", targetPhrase: "tuttavia", phraseType: "structural" },
    { phrase: "therefore", targetPhrase: "quindi", phraseType: "structural" },
    { phrase: "time", targetPhrase: "tempo", phraseType: "lexical" },
    { phrase: "people", targetPhrase: "gente", phraseType: "lexical" },
    { phrase: "work", targetPhrase: "lavoro", phraseType: "lexical" },
    { phrase: "important", targetPhrase: "importante", phraseType: "lexical" },
  ],
};

/**
 * Ensures foundational phrases for the given language exist in phrase state with high confidence.
 * Used when debug learner level is "everything" so basics are treated as known and planner focuses on new phrases.
 */
export async function seedFoundationalPhrases(targetLanguage: string): Promise<void> {
  const list = FOUNDATIONAL_BY_LANGUAGE[targetLanguage];
  if (!list || list.length === 0) return;
  const state = await getPhraseState();
  const now = Date.now();
  const url = "";
  const title = "";
  for (const { phrase, targetPhrase, phraseType } of list) {
    const existing = state.seenPhrases.find(
      (e) => e.phrase.toLowerCase() === phrase.toLowerCase() && e.targetLanguage === targetLanguage,
    );
    if (existing) {
      existing.confidence = 1.0;
      existing.lastSeenAt = now;
    } else {
      state.seenPhrases.push({
        phrase,
        targetPhrase,
        targetLanguage,
        phraseType,
        confidence: 1.0,
        exposures: 1,
        reveals: 0,
        passedCount: 0,
        firstSeenAt: now,
        lastSeenAt: now,
        firstSeenUrl: url,
        firstSeenTitle: title,
      });
    }
  }
  await savePhraseState(state);
}

export async function touchPhraseSession(now: number = Date.now()): Promise<void> {
  const state = await getPhraseState();
  const THIRTY_MINUTES_MS = 30 * 60 * 1000;
  if (now - state.lastSessionAt > THIRTY_MINUTES_MS) {
    state.totalSessionCount += 1;
    state.lastSessionAt = now;
    await savePhraseState(state);
    return;
  }

  if (state.lastSessionAt !== now) {
    state.lastSessionAt = now;
    await savePhraseState(state);
  }
}
