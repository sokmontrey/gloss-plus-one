import { callGemini } from "../api/gemini";
import { callGroq } from "../api/groq";
import { getPhraseBank, removeLastBatch, savePhraseBank } from "../memory/bankStore";
import { getUserContext } from "../memory/store";
import type { TriggerPlannerReason } from "@/shared/messages";
import type { BankPhrase, PhraseBank, UserContext } from "@/shared/types";

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

  const [bank, userContext] = await Promise.all([getPhraseBank(language), getUserContext()]);
  const batchId = crypto.randomUUID();
  const nextTier = triggerReason === "initial" ? 1 : bank.currentTier + 1;
  const newPhrases = await generatePhraseBatch(bank, userContext, nextTier, batchId, triggerReason, language);

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
  tier: number,
  batchId: string,
  triggerReason: TriggerPlannerReason,
  language: string,
): Promise<BankPhrase[]> {
  const existingPhrases = bank.phrases.map((phrase) => normalizePhrase(phrase.phrase).toLowerCase());
  const existingSet = new Set(existingPhrases);
  const prompt =
    tier >= 4
      ? buildExplorationPrompt(userContext, existingPhrases, language, tier)
      : buildStructuralPrompt(userContext, existingPhrases, language, tier);

  console.log(`[GlossPlusOne:planner] Generating tier ${tier} batch for ${language} (${triggerReason})`);

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
  const clean = stripMarkdownFences(raw);
  const parsed = JSON.parse(clean) as unknown;
  const payload = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as Record<string, unknown>).phrases)
      ? ((parsed as Record<string, unknown>).phrases as unknown[])
      : [];

  return payload.filter(isRawPlannerPhrase);
}

function buildStructuralPrompt(
  userContext: UserContext,
  existing: string[],
  language: string,
  tier: number,
): string {
  const tierLabel = ["", "A1", "A2", "B1", "B2", "C1", "C2"][tier] ?? "B1";

  return `
You are building a language acquisition phrase bank for a learner.
Native language: ${userContext.nativeLanguage}
Target language: ${language}
Current tier: ${tierLabel}

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
  existing: string[],
  language: string,
  tier: number,
): string {
  const tierLabel = ["", "A1", "A2", "B1", "B2", "C1", "C2"][tier] ?? "B2";

  return `
You are building a lexical exploration phrase bank for an advanced learner.
Native language: ${userContext.nativeLanguage}
Target language: ${language}
Current tier: ${tierLabel}

ALREADY IN BANK (do NOT include these):
${existing.length > 0 ? existing.slice(-30).map((phrase) => `  "${phrase}"`).join("\n") : "  none yet"}
(showing last 30 of ${existing.length} total)

The learner has mastered structural patterns and is now in exploration mode.
Generate exactly 10 lexical phrases that expand vocabulary and collocations.
Focus on: domain collocations, near-synonyms, idiomatic expressions,
register markers, sophisticated connectors.

Consider common reading domains: news, technology, culture, opinion pieces.

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
