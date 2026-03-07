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
