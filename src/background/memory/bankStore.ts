import { BANK_KEY, getPhraseBankFromSnapshot, savePhraseBankToSnapshot } from "@/shared/phraseBankStorage";
import type { PhraseBank, ProgressionConfig } from "@/shared/types";
const CONFIG_KEY = "glossProgressionConfig";

const DEFAULT_PROGRESSION_CONFIG: ProgressionConfig = {
  progressionThreshold: 0.7,
  confidenceGainPerExposure: 0.03,
  confidenceDecayPerHover: 0.1,
  hoverDecayThresholdMs: 2000,
};

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
  phrase.confidence = Math.min(1, phrase.confidence + config.confidenceGainPerExposure);

  await savePhraseBank(bank);
}

export async function recordHoverDecay(phraseId: string, language: string): Promise<void> {
  const [bank, config] = await Promise.all([getPhraseBank(language), getProgressionConfig()]);
  const phrase = bank.phrases.find((candidate) => candidate.id === phraseId);

  if (!phrase) {
    return;
  }

  phrase.hoverCount += 1;
  phrase.confidence = Math.max(0, phrase.confidence - config.confidenceDecayPerHover);

  await savePhraseBank(bank);
}

export async function shouldTriggerProgression(language: string): Promise<boolean> {
  const [bank, config] = await Promise.all([getPhraseBank(language), getProgressionConfig()]);
  const currentTierPhrases = bank.phrases.filter(
    (phrase) => phrase.tier === bank.currentTier && phrase.exposures >= 3,
  );

  if (currentTierPhrases.length < 3) {
    return false;
  }

  const averageConfidence =
    currentTierPhrases.reduce((sum, phrase) => sum + phrase.confidence, 0) / currentTierPhrases.length;

  return averageConfidence >= config.progressionThreshold;
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
