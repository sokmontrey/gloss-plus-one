import type { PhraseBank } from "@/shared/types";

export const BANK_KEY = "glossPhraseBank";

type PhraseBankSnapshot = Record<string, PhraseBank>;

export function createEmptyPhraseBank(language: string): PhraseBank {
  return {
    phrases: [],
    language,
    currentTier: 1,
    lastPlannerRunAt: 0,
    lastBatchId: "",
    batches: [],
  };
}

function isPhraseBank(value: unknown): value is PhraseBank {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.language === "string" && Array.isArray(candidate.phrases) && Array.isArray(candidate.batches);
}

function normalizePhraseBank(bank: PhraseBank, languageOverride?: string): PhraseBank {
  const language = languageOverride ?? bank.language;
  return {
    ...createEmptyPhraseBank(language),
    ...bank,
    language,
    phrases: bank.phrases ?? [],
    batches: bank.batches ?? [],
  };
}

function toPhraseBankSnapshot(value: unknown): PhraseBankSnapshot {
  if (isPhraseBank(value)) {
    return {
      [value.language]: normalizePhraseBank(value),
    };
  }

  if (!value || typeof value !== "object") {
    return {};
  }

  const snapshot: PhraseBankSnapshot = {};
  for (const [language, bank] of Object.entries(value as Record<string, unknown>)) {
    if (!isPhraseBank(bank)) {
      continue;
    }

    snapshot[language] = normalizePhraseBank(bank, language);
  }

  return snapshot;
}

export function getPhraseBankFromSnapshot(value: unknown, language: string): PhraseBank {
  const snapshot = toPhraseBankSnapshot(value);
  const bank = snapshot[language];
  return bank ? normalizePhraseBank(bank, language) : createEmptyPhraseBank(language);
}

export function savePhraseBankToSnapshot(value: unknown, bank: PhraseBank): PhraseBankSnapshot {
  const snapshot = toPhraseBankSnapshot(value);
  snapshot[bank.language] = normalizePhraseBank(bank);
  return snapshot;
}
