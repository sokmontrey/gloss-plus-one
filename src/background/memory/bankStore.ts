import {
  BANK_KEY,
  createEmptyPhraseBank,
  getPhraseBankFromSnapshot,
  savePhraseBankToSnapshot,
} from "@/shared/phraseBankStorage";
import type { BankPhrase, PhraseBank, PhraseBatch, ProgressionConfig } from "@/shared/types";
const CONFIG_KEY = "glossProgressionConfig";
const MIN_PROGRESS_PHRASES = 3;
const MAX_PROGRESS_SAMPLE = 10;

const DEFAULT_PROGRESSION_CONFIG: ProgressionConfig = {
  progressionThreshold: 0.7,
  confidenceGainPerExposure: 0.16,
  confidenceDecayPerHover: 0.12,
  hoverDecayThresholdMs: 2000,
};

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isProgressionBatch(batch: PhraseBatch): boolean {
  return batch.triggerReason === "initial" || batch.triggerReason === "progression";
}

function getLatestProgressionBatch(bank: PhraseBank): PhraseBatch | null {
  for (let index = bank.batches.length - 1; index >= 0; index -= 1) {
    const batch = bank.batches[index];
    if (isProgressionBatch(batch) && !batch.progressionTriggeredAt) {
      return batch;
    }
  }

  return null;
}

function getProgressionSample(bank: PhraseBank): typeof bank.phrases {
  const batch = getLatestProgressionBatch(bank);
  if (!batch) {
    return [];
  }

  return bank.phrases
    .filter((phrase) => phrase.addedByBatch === batch.id)
    .filter((phrase) => phrase.exposures > 0)
    .sort((left, right) => {
      const leftScore = left.lastSeenAt || left.addedAt;
      const rightScore = right.lastSeenAt || right.addedAt;
      return rightScore - leftScore;
    })
    .slice(0, MAX_PROGRESS_SAMPLE);
}

function getAverageConfidence(sample: BankPhrase[]): number {
  if (sample.length === 0) {
    return 0;
  }

  return sample.reduce((sum, phrase) => sum + phrase.confidence, 0) / sample.length;
}

export async function getPhraseBank(language: string): Promise<PhraseBank> {
  const result = await chrome.storage.local.get(BANK_KEY);
  return getPhraseBankFromSnapshot(result[BANK_KEY], language);
}

export async function savePhraseBank(bank: PhraseBank): Promise<void> {
  const result = await chrome.storage.local.get(BANK_KEY);
  await chrome.storage.local.set({
    [BANK_KEY]: savePhraseBankToSnapshot(result[BANK_KEY], bank),
  });
}

export async function resetPhraseBank(language: string): Promise<void> {
  const result = await chrome.storage.local.get(BANK_KEY);
  await chrome.storage.local.set({
    [BANK_KEY]: savePhraseBankToSnapshot(result[BANK_KEY], createEmptyPhraseBank(language)),
  });
}

export async function getProgressionConfig(): Promise<ProgressionConfig> {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  return {
    ...DEFAULT_PROGRESSION_CONFIG,
    ...(result[CONFIG_KEY] as Partial<ProgressionConfig> | undefined),
  };
}

export async function saveProgressionConfig(config: Partial<ProgressionConfig>): Promise<void> {
  const current = await getProgressionConfig();
  await chrome.storage.local.set({
    [CONFIG_KEY]: {
      ...current,
      ...config,
    },
  });
}

export async function recordExposure(
  phraseId: string,
  url: string,
  title: string,
  language: string,
): Promise<void> {
  const [bank, config] = await Promise.all([getPhraseBank(language), getProgressionConfig()]);
  const phrase = bank.phrases.find((candidate) => candidate.id === phraseId);

  if (!phrase) {
    return;
  }

  phrase.exposures += 1;
  phrase.lastSeenAt = Date.now();
  if (!phrase.firstSeenUrl) {
    phrase.firstSeenUrl = url;
    phrase.firstSeenTitle = title;
  }
  phrase.confidence = clampConfidence(phrase.confidence + config.confidenceGainPerExposure);

  await savePhraseBank(bank);
}

export async function recordHoverDecay(phraseId: string, language: string): Promise<void> {
  const [bank, config] = await Promise.all([getPhraseBank(language), getProgressionConfig()]);
  const phrase = bank.phrases.find((candidate) => candidate.id === phraseId);

  if (!phrase) {
    return;
  }

  phrase.hoverCount += 1;
  phrase.confidence = clampConfidence(phrase.confidence - config.confidenceDecayPerHover);

  await savePhraseBank(bank);
}

export async function shouldTriggerProgression(language: string): Promise<boolean> {
  const [bank, config] = await Promise.all([getPhraseBank(language), getProgressionConfig()]);
  const sample = getProgressionSample(bank);
  if (sample.length < MIN_PROGRESS_PHRASES) {
    return false;
  }

  return getAverageConfidence(sample) >= config.progressionThreshold;
}

export async function consumeProgressionTrigger(language: string): Promise<boolean> {
  const [bank, config] = await Promise.all([getPhraseBank(language), getProgressionConfig()]);
  const latestBatch = getLatestProgressionBatch(bank);
  if (!latestBatch) {
    return false;
  }

  const sample = getProgressionSample(bank);
  if (sample.length < MIN_PROGRESS_PHRASES) {
    return false;
  }

  if (getAverageConfidence(sample) < config.progressionThreshold) {
    return false;
  }

  latestBatch.progressionTriggeredAt = Date.now();
  await savePhraseBank(bank);
  return true;
}

export async function removeLastBatch(language: string): Promise<void> {
  const bank = await getPhraseBank(language);

  if (bank.batches.length === 0) {
    return;
  }

  const lastBatch = bank.batches[bank.batches.length - 1];
  bank.phrases = bank.phrases.filter((phrase) => phrase.addedByBatch !== lastBatch.id);
  bank.batches = bank.batches.slice(0, -1);

  const remainingBatch = bank.batches[bank.batches.length - 1];
  bank.currentTier = remainingBatch?.tier ?? 1;
  bank.lastBatchId = remainingBatch?.id ?? "";

  await savePhraseBank(bank);
}
