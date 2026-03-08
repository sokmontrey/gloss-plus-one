import type { PageSignal, UserInterestProfile } from "@/shared/types";

const SIGNAL_KEY = "glossPageSignals";
const INTEREST_KEY = "glossInterestProfile";
const MAX_SIGNALS = 100;

const DEFAULT_INTEREST_PROFILE: UserInterestProfile = {
  topTopics: [],
  topDomains: [],
  recentTopics: [],
  lastUpdatedAt: 0,
};

function normalizePageSignal(signal: unknown): PageSignal | null {
  if (!signal || typeof signal !== "object") {
    return null;
  }

  const candidate = signal as Partial<PageSignal>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.url !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.domain !== "string" ||
    typeof candidate.pageType !== "string" ||
    typeof candidate.replacementCount !== "number" ||
    typeof candidate.visitedAt !== "number"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    url: candidate.url,
    title: candidate.title,
    domain: candidate.domain,
    pageType: candidate.pageType,
    topic: typeof candidate.topic === "string" ? candidate.topic : null,
    contentSnippet: typeof candidate.contentSnippet === "string" ? candidate.contentSnippet : "",
    replacementCount: candidate.replacementCount,
    visitedAt: candidate.visitedAt,
  };
}

export async function recordPageSignal(signal: Omit<PageSignal, "id">): Promise<void> {
  const stored = await getPageSignals();
  stored.push({ ...signal, id: crypto.randomUUID() });
  const trimmed = stored.slice(-MAX_SIGNALS);
  await chrome.storage.local.set({ [SIGNAL_KEY]: trimmed });
}

export async function getPageSignals(): Promise<PageSignal[]> {
  const result = await chrome.storage.local.get(SIGNAL_KEY);
  const stored = result[SIGNAL_KEY];
  if (!Array.isArray(stored)) {
    return [];
  }

  return stored
    .map((signal) => normalizePageSignal(signal))
    .filter((signal): signal is PageSignal => signal !== null);
}

export async function getInterestProfile(): Promise<UserInterestProfile> {
  const result = await chrome.storage.local.get(INTEREST_KEY);
  return (result[INTEREST_KEY] as UserInterestProfile | undefined) ?? DEFAULT_INTEREST_PROFILE;
}

export async function saveInterestProfile(profile: UserInterestProfile): Promise<void> {
  await chrome.storage.local.set({ [INTEREST_KEY]: profile });
}

export async function recomputeInterestProfile(): Promise<void> {
  const signals = await getPageSignals();
  if (signals.length === 0) {
    return;
  }

  const domainCounts = new Map<string, number>();
  for (const signal of signals) {
    domainCounts.set(signal.domain, (domainCounts.get(signal.domain) ?? 0) + 1);
  }

  const topDomains = [...domainCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([domain]) => domain);

  const topicWeights = new Map<string, number>();
  const now = Date.now();
  signals.forEach((signal, index) => {
    if (!signal.topic) {
      return;
    }

    const recencyWeight = 1 + index / signals.length;
    const ageMs = now - signal.visitedAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const decayWeight = Math.exp(-0.1 * ageDays);
    const weight = recencyWeight * decayWeight;
    topicWeights.set(signal.topic, (topicWeights.get(signal.topic) ?? 0) + weight);
  });

  const topTopics = [...topicWeights.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([topic]) => topic);

  const recentTopics = signals
    .slice(-10)
    .map((signal) => signal.topic)
    .filter((topic): topic is string => Boolean(topic))
    .filter((topic, index, array) => array.indexOf(topic) === index)
    .slice(0, 5);

  await saveInterestProfile({
    topTopics,
    topDomains,
    recentTopics,
    lastUpdatedAt: Date.now(),
  });
}
