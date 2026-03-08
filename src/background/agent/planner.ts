import { callGemini } from "../api/gemini";
import { callGroq } from "../api/groq";
import { getPhraseBank, removeLastBatch, savePhraseBank } from "../memory/bankStore";
import { getInterestProfile, getPageSignals } from "../memory/pageSignalStore";
import { getUserContext } from "../memory/store";
import type { TriggerPlannerReason } from "@/shared/messages";
import type { BankPhrase, PageSignal, PhraseBank, UserContext, UserInterestProfile } from "@/shared/types";

interface RawPlannerPhrase {
  phrase: string;
  targetPhrase: string;
  phraseType: "structural" | "lexical";
  pedagogicalNote?: string;
}

function stripMarkdownFences(value: string): string {
  return value.replace(/```json|```/gi, "").trim();
}

function normalizePhrase(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractJsonPayload(value: string): string {
  const firstArrayIndex = value.indexOf("[");
  const lastArrayIndex = value.lastIndexOf("]");
  if (firstArrayIndex !== -1 && lastArrayIndex > firstArrayIndex) {
    return value.slice(firstArrayIndex, lastArrayIndex + 1);
  }

  const firstObjectIndex = value.indexOf("{");
  const lastObjectIndex = value.lastIndexOf("}");
  if (firstObjectIndex !== -1 && lastObjectIndex > firstObjectIndex) {
    return value.slice(firstObjectIndex, lastObjectIndex + 1);
  }

  return value;
}

function replaceSingleQuotedStrings(value: string): string {
  return value.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner: string) => JSON.stringify(inner));
}

function repairLikelyJson(value: string): string {
  return replaceSingleQuotedStrings(value)
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
    .replace(/,\s*([}\]])/g, "$1");
}

function parseJsonWithRepairs(raw: string): unknown {
  const extracted = extractJsonPayload(stripMarkdownFences(raw));
  const attempts = [
    extracted,
    repairLikelyJson(extracted),
  ];

  let lastError: unknown = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("PLANNER_JSON_PARSE_FAILED");
}

function isRawPlannerPhrase(value: unknown): value is RawPlannerPhrase {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.phrase === "string" &&
    typeof candidate.targetPhrase === "string" &&
    (candidate.phraseType === "structural" || candidate.phraseType === "lexical")
  );
}

export async function callPlannerLLM(prompt: string, responseMimeType = "application/json"): Promise<string> {
  try {
    return await callGemini(prompt, responseMimeType);
  } catch (error) {
    console.warn("[GlossPlusOne:planner] Gemini failed, trying Groq:", error);
    return await callGroq(prompt, responseMimeType);
  }
}

export async function runPlanner(triggerReason: TriggerPlannerReason, language: string): Promise<void> {
  if (triggerReason === "debug_decrement") {
    await removeLastBatch(language);
    return;
  }

  const [bank, userContext, interestProfile, pageSignals] = await Promise.all([
    getPhraseBank(language),
    getUserContext(),
    getInterestProfile(),
    getPageSignals(),
  ]);
  const batchId = crypto.randomUUID();
  const nextTier = triggerReason === "initial" ? 1 : bank.currentTier + 1;
  const newPhrases = await generatePhraseBatch(
    bank,
    userContext,
    interestProfile,
    pageSignals,
    nextTier,
    batchId,
    triggerReason,
    language,
  );

  if (newPhrases.length === 0) {
    console.warn("[GlossPlusOne:planner] Planner returned empty batch");
    return;
  }

  bank.phrases.push(...newPhrases);
  bank.currentTier = nextTier;
  bank.lastPlannerRunAt = Date.now();
  bank.lastBatchId = batchId;
  bank.batches.push({
    id: batchId,
    addedAt: Date.now(),
    tier: nextTier,
    triggerReason,
    phraseCount: newPhrases.length,
    plannerContext: `Tier ${nextTier} batch for ${language}`,
  });

  await savePhraseBank(bank);
  console.log(
    `[GlossPlusOne:planner] Bank updated — added ${newPhrases.length} phrases at tier ${nextTier} (${triggerReason})`,
  );
}

async function generatePhraseBatch(
  bank: PhraseBank,
  userContext: UserContext,
  interestProfile: UserInterestProfile,
  pageSignals: PageSignal[],
  tier: number,
  batchId: string,
  triggerReason: TriggerPlannerReason,
  language: string,
): Promise<BankPhrase[]> {
  const existingPhrases = bank.phrases.map((phrase) => normalizePhrase(phrase.phrase).toLowerCase());
  const existingSet = new Set(existingPhrases);
  const recentReadingSamples = buildRecentReadingSamples(pageSignals);
  const prompt =
    tier >= 4
      ? buildExplorationPrompt(userContext, interestProfile, existingPhrases, recentReadingSamples, language, tier)
      : buildStructuralPrompt(userContext, interestProfile, existingPhrases, recentReadingSamples, language, tier);

  console.log(
    `[GlossPlusOne:planner] Generating tier ${tier} batch for ${language} (${triggerReason})`,
    {
      topTopics: interestProfile.topTopics.slice(0, 3),
      topDomains: interestProfile.topDomains.slice(0, 3),
      recentTopics: interestProfile.recentTopics.slice(0, 3),
      recentSamples: recentReadingSamples.length,
    },
  );

  try {
    const raw = await callPlannerLLM(prompt);
    const parsed = parsePlannerResponse(raw);
    const now = Date.now();

    return parsed
      .map((phrase) => ({
        id: crypto.randomUUID(),
        phrase: normalizePhrase(phrase.phrase),
        targetPhrase: normalizePhrase(phrase.targetPhrase),
        targetLanguage: language,
        nativeLanguage: userContext.nativeLanguage,
        phraseType: phrase.phraseType,
        tier,
        addedAt: now,
        addedByBatch: batchId,
        confidence: 0,
        exposures: 0,
        hoverCount: 0,
        lastSeenAt: 0,
        firstSeenUrl: "",
        firstSeenTitle: "",
      }))
      .filter((phrase) => phrase.phrase.length > 0 && phrase.targetPhrase.length > 0)
      .filter((phrase) => !existingSet.has(phrase.phrase.toLowerCase()));
  } catch (error) {
    console.error("[GlossPlusOne:planner] Batch generation failed:", error);
    return [];
  }
}

function parsePlannerResponse(raw: string): RawPlannerPhrase[] {
  const parsed = parseJsonWithRepairs(raw);
  const payload = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as Record<string, unknown>).phrases)
      ? ((parsed as Record<string, unknown>).phrases as unknown[])
      : [];

  return payload.filter(isRawPlannerPhrase);
}

function buildRecentReadingSamples(signals: PageSignal[]): string[] {
  return [...signals]
    .reverse()
    .filter((signal) => signal.contentSnippet.trim().length > 0)
    .slice(0, 4)
    .map((signal) => {
      const topicLabel = signal.topic ? `Topic: ${signal.topic}` : "Topic: unknown";
      return `Title: ${signal.title}
Domain: ${signal.domain}
${topicLabel}
Excerpt: ${signal.contentSnippet}`;
    });
}

function buildStructuralPrompt(
  userContext: UserContext,
  interestProfile: UserInterestProfile,
  existing: string[],
  recentReadingSamples: string[],
  language: string,
  tier: number,
): string {
  const tierLabel = ["", "A1", "A2", "B1", "B2", "C1", "C2"][tier] ?? "B1";
  const readingContext =
    interestProfile.topTopics.length > 0
      ? `
USER READING CONTEXT:
This learner regularly reads about: ${interestProfile.topTopics.join(", ")}
Recent topics: ${interestProfile.recentTopics.join(", ")}
Frequent domains: ${interestProfile.topDomains.join(", ")}

When multiple phrase options are equally appropriate for tier ${tierLabel},
PREFER phrases that appear naturally in ${interestProfile.topTopics[0] ?? "general"}
content. For example, if they read tech articles, prefer "as a result"
over "in the garden" as a context for grammar demonstration.
`
      : "";
  const readingSamplesContext =
    recentReadingSamples.length > 0
      ? `
RECENT PAGE EXCERPTS:
${recentReadingSamples.map((sample, index) => `Sample ${index + 1}:\n${sample}`).join("\n\n")}

Use these excerpts to choose structural phrases that appear naturally in what the learner is actually reading.
Prefer grammar chunks and connectors that fit the syntax, tone, and discourse patterns in these passages.
`
      : "";

  return `
You are building a language acquisition phrase bank for a learner.
Native language: ${userContext.nativeLanguage}
Target language: ${language}
Current tier: ${tierLabel}
${readingContext}
${readingSamplesContext}

ALREADY IN BANK (do NOT include these):
${existing.length > 0 ? existing.map((phrase) => `  "${phrase}"`).join("\n") : "  none yet"}

Generate exactly 12 structural phrases appropriate for ${tierLabel} level.
These are multi-word chunks that demonstrate grammar patterns.
Focus on: discourse connectors, copula constructions, existential frames,
modal phrases, purpose/cause structures, question formations.

Rules:
- Phrases must be 1-4 words
- Must appear frequently in written English
- Must NOT be in the already-in-bank list
- Generate the most natural ${language} equivalent (not literal translation)
- phraseType should always be "structural"

Return ONLY valid JSON array, no markdown, no explanation:
[
  {
    "phrase": "this is",
    "targetPhrase": "esto es",
    "phraseType": "structural",
    "pedagogicalNote": "copula with demonstrative"
  }
]`;
}

function buildExplorationPrompt(
  userContext: UserContext,
  interestProfile: UserInterestProfile,
  existing: string[],
  recentReadingSamples: string[],
  language: string,
  tier: number,
): string {
  const tierLabel = ["", "A1", "A2", "B1", "B2", "C1", "C2"][tier] ?? "B2";
  const readingSamplesContext =
    recentReadingSamples.length > 0
      ? `
RECENT PAGE EXCERPTS:
${recentReadingSamples.map((sample, index) => `Sample ${index + 1}:\n${sample}`).join("\n\n")}

Use these excerpts to select lexical phrases that are likely to appear again in this learner's real reading.
Favor collocations, domain vocabulary, and connectors directly supported by the sample passages.
`
      : "";

  return `
You are building a lexical exploration phrase bank for an advanced learner.
Native language: ${userContext.nativeLanguage}
Target language: ${language}
Current tier: ${tierLabel}
${readingSamplesContext}

ALREADY IN BANK (do NOT include these):
${existing.length > 0 ? existing.slice(-30).map((phrase) => `  "${phrase}"`).join("\n") : "  none yet"}
(showing last 30 of ${existing.length} total)

The learner has mastered structural patterns and is now in exploration mode.
Generate exactly 10 lexical phrases that expand vocabulary and collocations.
Focus on: domain collocations, near-synonyms, idiomatic expressions,
register markers, sophisticated connectors.

Consider common reading domains: news, technology, culture, opinion pieces.

USER INTERESTS (use these to select relevant vocabulary):
Primary topics: ${interestProfile.topTopics.slice(0, 3).join(", ") || "general"}
Recent reading: ${interestProfile.recentTopics.join(", ") || "varied"}

Generate lexical phrases that would appear in content about these topics.
A tech reader should learn "open source", "deployment pipeline",
"machine learning" vocabulary - not cooking or sports terms.
Match vocabulary domain to the user's actual reading habits.

Rules:
- Phrases must be 1-5 words
- Must be phrases the learner hasn't seen yet
- Generate the most natural ${language} equivalent
- phraseType should always be "lexical"

Return ONLY valid JSON array, no markdown:
[
  {
    "phrase": "raises concerns",
    "targetPhrase": "plantea preocupaciones",
    "phraseType": "lexical",
    "pedagogicalNote": "verb-noun collocation common in news"
  }
]`;
}

export async function extractPageTopic(
  title: string,
  domain: string,
  pageType: string,
  contentSnippet: string,
): Promise<string | null> {
  if (pageType === "unknown" || !title || title.length < 5) {
    return null;
  }

  const prompt = `Article title: "${title}"
Domain: ${domain}
Excerpt:
${contentSnippet || "No excerpt available"}

Reply with ONLY a topic label, 3 words maximum, no punctuation.
Examples: "machine learning inference", "Canadian federal election",
"personal finance tips", "web development tools"
Topic:`;

  try {
    const raw = await callPlannerLLM(prompt, "text/plain");
    const topic = raw.trim().replace(/[^\w\s]/g, "").slice(0, 40).trim();
    return topic || null;
  } catch {
    return null;
  }
}
