import { callGemini } from "../api/gemini";
import { callGroq } from "../api/groq";
import { getPhraseBank, removeLastBatch, savePhraseBank } from "../memory/bankStore";
import { getUserContext } from "../memory/store";
import { STRUCTURAL_PHRASES } from "@/shared/structuralPhrases";
import type { TriggerPlannerReason } from "@/shared/messages";
import type { BankPhrase, UserContext } from "@/shared/types";

const PROCESSED_URLS_KEY = "glossProcessedUrls";
const MAX_DISCOVERY_URLS = 500;
const MAX_TIER = 6;

function normalizePhrase(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePhraseKey(value: string): string {
  return normalizePhrase(value).toLowerCase();
}

function extractJsonPayload(raw: string): string {
  const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const firstArrayIndex = clean.indexOf("[");
  const lastArrayIndex = clean.lastIndexOf("]");
  if (firstArrayIndex !== -1 && lastArrayIndex > firstArrayIndex) {
    return clean.slice(firstArrayIndex, lastArrayIndex + 1);
  }

  const firstObjectIndex = clean.indexOf("{");
  const lastObjectIndex = clean.lastIndexOf("}");
  if (firstObjectIndex !== -1 && lastObjectIndex > firstObjectIndex) {
    return clean.slice(firstObjectIndex, lastObjectIndex + 1);
  }

  return clean;
}

function getTierCefrBand(tier: number, fallback: UserContext["cefrBand"]): UserContext["cefrBand"] {
  const tierMap: Record<number, UserContext["cefrBand"]> = {
    1: "A1",
    2: "A2",
    3: "B1",
    4: "B2",
    5: "C1",
    6: "C2",
  };
  return tierMap[tier] ?? fallback;
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

  const bank = await getPhraseBank(language);
  const nextTier =
    triggerReason === "debug_increment" || triggerReason === "progression"
      ? Math.min(bank.currentTier + 1, MAX_TIER)
      : bank.currentTier;
  const changed =
    nextTier !== bank.currentTier || (triggerReason === "initial" && bank.currentTier < 1);

  if (!changed && triggerReason !== "progression") {
    return;
  }

  bank.currentTier = nextTier;
  bank.lastPlannerRunAt = Date.now();
  await savePhraseBank(bank);
  console.log(
    `[GlossPlusOne:planner] Updated tier to ${bank.currentTier} (${triggerReason})`,
  );
}

export function parseJsonResponse(raw: string): unknown {
  const clean = extractJsonPayload(raw);

  if (clean.startsWith("{")) {
    const obj = JSON.parse(clean) as Record<string, unknown>;
    const arr =
      obj.phrases ??
      obj.replacements ??
      obj.data ??
      obj.result ??
      obj.items ??
      Object.values(obj).find((value) => Array.isArray(value));
    if (Array.isArray(arr)) {
      return arr;
    }
  }

  return JSON.parse(clean);
}

export async function ensureStructuralTranslations(
  language: string,
  nativeLanguage: string,
): Promise<void> {
  const bank = await getPhraseBank(language);
  const alreadyTranslated = new Set(
    bank.phrases
      .filter((phrase) => phrase.phraseType === "structural")
      .map((phrase) => normalizePhraseKey(phrase.phrase)),
  );

  const untranslated = STRUCTURAL_PHRASES.filter(
    (phrase) => !alreadyTranslated.has(phrase.phrase),
  );
  if (untranslated.length === 0) {
    return;
  }

  console.log(
    `[GlossPlusOne:planner] Translating ${untranslated.length} structural phrases to ${language}`,
  );

  const prompt = `Translate these English phrases to ${language}.
Native language context: ${nativeLanguage}
Use the most natural, commonly used equivalent. Not literal translation.

Phrases to translate:
${untranslated.map((phrase) => `"${phrase.phrase}"`).join("\n")}

Return a JSON array and nothing else. No markdown. Start with [.
[
  { "phrase": "this is", "targetPhrase": "c'est" },
  { "phrase": "however", "targetPhrase": "cependant" }
]`;

  try {
    const raw = await callPlannerLLM(prompt);
    const parsed = parseJsonResponse(raw) as Array<{
      phrase: string;
      targetPhrase: string;
    }>;
    if (!Array.isArray(parsed)) {
      return;
    }

    const batchId = crypto.randomUUID();
    const seen = new Set(bank.phrases.map((phrase) => normalizePhraseKey(phrase.phrase)));
    const newPhrases = parsed
      .filter((phrase) => phrase.phrase && phrase.targetPhrase)
      .map((phrase): BankPhrase | null => {
        const normalizedPhrase = normalizePhraseKey(phrase.phrase);
        const structural = untranslated.find((candidate) => candidate.phrase === normalizedPhrase);
        if (!structural || seen.has(normalizedPhrase)) {
          return null;
        }

        seen.add(normalizedPhrase);
        return {
          id: crypto.randomUUID(),
          phrase: normalizedPhrase,
          targetPhrase: normalizePhrase(phrase.targetPhrase),
          targetLanguage: language,
          nativeLanguage,
          phraseType: "structural" as const,
          tier: structural.tier,
          addedAt: Date.now(),
          addedByBatch: batchId,
          confidence: 0,
          exposures: 0,
          hoverCount: 0,
          lastSeenAt: 0,
          firstSeenUrl: "",
          firstSeenTitle: "",
        };
      })
      .filter((phrase): phrase is BankPhrase => phrase !== null);

    if (newPhrases.length === 0) {
      return;
    }

    bank.phrases.push(...newPhrases);
    await savePhraseBank(bank);
    console.log(
      `[GlossPlusOne:planner] Structural translations cached: ${newPhrases.length}`,
    );
  } catch (err) {
    console.error("[GlossPlusOne:planner] Structural translation failed:", err);
  }
}

async function getProcessedUrls(): Promise<Set<string>> {
  const result = await chrome.storage.local.get(PROCESSED_URLS_KEY);
  return new Set((result[PROCESSED_URLS_KEY] as string[] | undefined) ?? []);
}

async function markUrlProcessed(urlHash: string): Promise<void> {
  const existing = await getProcessedUrls();
  existing.add(urlHash);
  const trimmed = [...existing].slice(-MAX_DISCOVERY_URLS);
  await chrome.storage.local.set({ [PROCESSED_URLS_KEY]: trimmed });
}

export async function clearProcessedUrls(): Promise<void> {
  await chrome.storage.local.set({ [PROCESSED_URLS_KEY]: [] });
}

function hashUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`
      .toLowerCase()
      .replace(/[^a-z0-9/]/g, "")
      .slice(0, 80);
  } catch {
    return url.slice(0, 80);
  }
}

export async function runPageDiscovery(
  pageText: string,
  pageTitle: string,
  pageUrl: string,
  language: string,
): Promise<void> {
  const urlHash = hashUrl(pageUrl);
  const processed = await getProcessedUrls();
  if (processed.has(urlHash)) {
    console.log("[GlossPlusOne:planner] URL already processed, skipping");
    return;
  }

  const [bank, userContext] = await Promise.all([
    getPhraseBank(language),
    getUserContext(),
  ]);
  const existingPhrases = bank.phrases.map((phrase) => normalizePhraseKey(phrase.phrase));
  const existingSet = new Set(existingPhrases);
  const effectiveBand = getTierCefrBand(bank.currentTier, userContext.cefrBand);

  const prompt = `You are a language teacher selecting vocabulary for a ${userContext.cefrBand} learner.
Native language: ${userContext.nativeLanguage}
Target language: ${language}
Current discovery tier: ${bank.currentTier} (${effectiveBand})

Page title: "${pageTitle}"
Page content excerpt:
"${pageText.slice(0, 800)}"

Phrases already in the learner's bank (DO NOT repeat these):
${existingPhrases.slice(-40).map((phrase) => `"${phrase}"`).join(", ")}

Select 5-8 phrases from this specific page content that are:
- Worth learning at about ${effectiveBand} level
- Actually present in the text above (or close variants)
- Not already in the bank list above
- 1-5 words each

Return a JSON array and nothing else. Start with [.
[
  {
    "phrase": "raises concerns",
    "targetPhrase": "soulève des préoccupations",
    "phraseType": "lexical"
  }
]`;

  try {
    const raw = await callPlannerLLM(prompt);
    const parsed = parseJsonResponse(raw) as Array<{
      phrase: string;
      targetPhrase: string;
      phraseType?: string;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn("[GlossPlusOne:planner] Page discovery returned empty");
      await markUrlProcessed(urlHash);
      return;
    }

    const batchId = crypto.randomUUID();
    const newPhrases = parsed
      .filter((phrase) => phrase.phrase && phrase.targetPhrase)
      .map((phrase): BankPhrase | null => {
        const normalizedPhrase = normalizePhraseKey(phrase.phrase);
        if (!normalizedPhrase || existingSet.has(normalizedPhrase)) {
          return null;
        }

        existingSet.add(normalizedPhrase);
        return {
          id: crypto.randomUUID(),
          phrase: normalizedPhrase,
          targetPhrase: normalizePhrase(phrase.targetPhrase),
          targetLanguage: language,
          nativeLanguage: userContext.nativeLanguage,
          phraseType:
            phrase.phraseType === "structural" || phrase.phraseType === "lexical"
              ? phrase.phraseType
              : "lexical" as const,
          tier: bank.currentTier,
          addedAt: Date.now(),
          addedByBatch: batchId,
          confidence: 0,
          exposures: 0,
          hoverCount: 0,
          lastSeenAt: 0,
          firstSeenUrl: pageUrl,
          firstSeenTitle: pageTitle,
        };
      })
      .filter((phrase): phrase is BankPhrase => phrase !== null);

    if (newPhrases.length === 0) {
      console.warn("[GlossPlusOne:planner] Page discovery returned only duplicates");
      await markUrlProcessed(urlHash);
      return;
    }

    bank.phrases.push(...newPhrases);
    bank.lastBatchId = batchId;
    bank.lastPlannerRunAt = Date.now();
    bank.batches.push({
      id: batchId,
      addedAt: Date.now(),
      tier: bank.currentTier,
      triggerReason: bank.currentTier > 1 ? "progression" : "initial",
      phraseCount: newPhrases.length,
      plannerContext: `Page discovery for ${pageTitle.slice(0, 80)}`,
    });
    await savePhraseBank(bank);
    await markUrlProcessed(urlHash);

    console.log(
      `[GlossPlusOne:planner] Page discovery added ${newPhrases.length} phrases`,
    );
  } catch (err) {
    console.error("[GlossPlusOne:planner] Page discovery failed:", err);
    await markUrlProcessed(urlHash);
  }
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
