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
/** Max page text length sent to a single fallback prompt. */
const PAGE_DISCOVERY_PROMPT_MAX_CHARS = 6_000;
const PAGE_DISCOVERY_CHUNK_MAX_CHARS = 2_400;
const PAGE_DISCOVERY_CHUNK_OVERLAP_CHARS = 250;
const PAGE_DISCOVERY_MAX_CHUNKS = 3;
const PAGE_DISCOVERY_MIN_RESULTS = 5;
const PAGE_DISCOVERY_MAX_RESULTS = 8;
const STRUCTURAL_TRANSLATION_BATCH_SIZE = 10;

function normalizePhrase(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePhraseKey(value: string): string {
  return normalizePhrase(value).toLowerCase();
}

function replaceSingleQuotedStrings(value: string): string {
  return value.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, inner: string) => JSON.stringify(inner));
}

function escapeNewlinesInStrings(value: string): string {
  let result = "";
  let inString = false;
  let quoteChar = '"';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const prev = value[index - 1];

    if (!inString) {
      if ((char === '"' || char === "'") && prev !== "\\") {
        inString = true;
        quoteChar = char;
      }
      result += char;
      continue;
    }

    if (char === quoteChar && prev !== "\\") {
      inString = false;
      result += char;
      continue;
    }

    if (char === "\n") {
      result += "\\n";
      continue;
    }

    if (char === "\r") {
      result += "\\r";
      continue;
    }

    result += char;
  }

  return result;
}

function repairLikelyJson(value: string): string {
  return escapeNewlinesInStrings(
    replaceSingleQuotedStrings(value)
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
      .replace(/,(\s*[}\]])/g, "$1"),
  );
}

function extractObjectsFromArray(value: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString: string | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const prev = value[index - 1];

    if (inString !== null) {
      if (char === inString && prev !== "\\") {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        objects.push(value.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}

/** Extract the first complete JSON array or object by bracket matching (avoids cutting inside string values). */
function extractJsonPayload(raw: string): string {
  const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const firstBracket = clean.indexOf("[");
  const firstBrace = clean.indexOf("{");
  const isArray = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace);
  const open = isArray ? "[" : "{";
  const close = isArray ? "]" : "}";
  const start = isArray ? firstBracket : firstBrace;
  if (start === -1) {
    return clean;
  }
  let depth = 0;
  let inString: string | null = null;
  let i = start;
  while (i < clean.length) {
    const c = clean[i];
    if (inString !== null) {
      if (c === "\\" && i + 1 < clean.length) {
        i += 2;
        continue;
      }
      if (c === inString) {
        inString = null;
      }
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = c;
      i += 1;
      continue;
    }
    if (c === open) {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === close) {
      depth -= 1;
      if (depth === 0) {
        return clean.slice(start, i + 1);
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return clean.slice(start);
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

interface DiscoveryPromptContext {
  pageTitle: string;
  language: string;
  nativeLanguage: string;
  cefrBand: UserContext["cefrBand"];
  currentTier: number;
  effectiveBand: UserContext["cefrBand"];
  nextBand: UserContext["cefrBand"];
  existingPhrases: string[];
}

interface DiscoveryCandidate {
  phrase: string;
  targetPhrase: string;
  phraseType?: string;
}

function splitDiscoveryTextIntoChunks(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= PAGE_DISCOVERY_CHUNK_MAX_CHARS) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length && chunks.length < PAGE_DISCOVERY_MAX_CHUNKS) {
    let end = Math.min(normalized.length, start + PAGE_DISCOVERY_CHUNK_MAX_CHARS);
    if (end < normalized.length) {
      const nextBoundary = Math.max(
        normalized.lastIndexOf(". ", end),
        normalized.lastIndexOf("! ", end),
        normalized.lastIndexOf("? ", end),
        normalized.lastIndexOf(" ", end),
      );
      if (nextBoundary > start + Math.floor(PAGE_DISCOVERY_CHUNK_MAX_CHARS * 0.6)) {
        end = nextBoundary + 1;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - PAGE_DISCOVERY_CHUNK_OVERLAP_CHARS, start + 1);
  }

  return chunks;
}

function chunkArray<T>(items: T[], size: number): T[][];
function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildPageDiscoveryPrompt(
  excerpt: string,
  context: DiscoveryPromptContext,
  chunkIndex?: number,
  chunkCount?: number,
): string {
  const chunkLabel =
    chunkCount && chunkCount > 1
      ? `\nChunk: ${chunkIndex ?? 1}/${chunkCount}. Select phrases only from this chunk.`
      : "";

  return `You are a language teacher selecting vocabulary for a ${context.cefrBand} learner.
Native language: ${context.nativeLanguage}
Target language: ${context.language}
Current discovery tier: ${context.currentTier} (${context.effectiveBand})
Target difficulty for new discoveries: approximately i+1 (${context.nextBand})${chunkLabel}

Page title: "${context.pageTitle}"
Page content excerpt:
"${excerpt}"

Phrases already in the learner's bank (DO NOT repeat these):
${context.existingPhrases.slice(-40).map((phrase) => `"${phrase}"`).join(", ")}

Select exactly 5 to 8 phrases from the page content above. You must return at least 5 phrases unless the excerpt contains fewer than 5 suitable candidates. Each phrase must be:
- Worth learning at approximately one step above the current bank (${context.nextBand})
- Actually present in the text above (or close variants)
- Not already in the bank list above
- 1-5 words each

Prioritize in this order:
1. Structural phrases and grammar chunks that support comprehension and feel like Krashen i+1
2. High-frequency discourse connectors, clause frames, modal/purpose/cause phrases
3. Lexical phrases only when the excerpt does not contain enough good structural candidates

Avoid random niche vocabulary, proper nouns, fragmented text, or phrases that are much harder than ${context.nextBand}.
Prefer phrases that make sense as the learner's next step from the current bank.
If possible, return mostly structural phrases and mark them with "phraseType": "structural".

Return a JSON array only. No markdown, no explanation. Start with [. Include 5-8 objects.
[
  { "phrase": "raises concerns", "targetPhrase": "soulève des préoccupations", "phraseType": "lexical" },
  { "phrase": "for example", "targetPhrase": "par exemple", "phraseType": "structural" }
]`;
}

async function collectGeminiDiscoveryCandidates(
  pageText: string,
  context: DiscoveryPromptContext,
): Promise<DiscoveryCandidate[]> {
  const chunks = splitDiscoveryTextIntoChunks(pageText);
  if (chunks.length === 0) {
    return [];
  }

  console.log("[GlossPlusOne:planner] Running Gemini chunked discovery", {
    chunkCount: chunks.length,
    chunkLengths: chunks.map((chunk) => chunk.length),
  });

  const aggregated: DiscoveryCandidate[] = [];
  const seen = new Set<string>();

  for (const [index, chunk] of chunks.entries()) {
    const prompt = buildPageDiscoveryPrompt(chunk, context, index + 1, chunks.length);
    const raw = await callGemini(prompt);
    console.log("[GlossPlusOne:planner] Page discovery raw Gemini chunk response:", {
      chunk: `${index + 1}/${chunks.length}`,
      raw,
    });

    const parsed = parseJsonResponse(raw) as DiscoveryCandidate[];
    if (!Array.isArray(parsed)) {
      continue;
    }

    for (const phrase of parsed) {
      const normalizedPhrase = normalizePhraseKey(phrase.phrase ?? "");
      if (!normalizedPhrase || seen.has(normalizedPhrase)) {
        continue;
      }

      seen.add(normalizedPhrase);
      aggregated.push(phrase);
      if (aggregated.length >= PAGE_DISCOVERY_MAX_RESULTS) {
        return aggregated;
      }
    }
  }

  return aggregated;
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
  const candidates = [clean, repairLikelyJson(clean)];

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      if (candidate.startsWith("{")) {
        const obj = JSON.parse(candidate) as Record<string, unknown>;
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

      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  const repaired = repairLikelyJson(clean);
  if (repaired.startsWith("[")) {
    const objects = extractObjectsFromArray(repaired);
    if (objects.length > 0) {
      const parsed = objects.flatMap((item) => {
        try {
          return [JSON.parse(repairLikelyJson(item)) as Record<string, unknown>];
        } catch {
          return [];
        }
      });
      if (parsed.length > 0) {
        return parsed;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("PLANNER_JSON_PARSE_FAILED");
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

  try {
    const parsed: Array<{
      phrase: string;
      targetPhrase: string;
    }> = [];

    const batches = chunkArray(untranslated, STRUCTURAL_TRANSLATION_BATCH_SIZE);
    for (const [index, batch] of batches.entries()) {
      const prompt = `Translate these English phrases to ${language}.
Native language context: ${nativeLanguage}
Use the most natural, commonly used equivalent. Not literal translation.
Batch ${index + 1}/${batches.length}. Translate every phrase in this batch.

Phrases to translate:
${batch.map((phrase) => `"${phrase.phrase}"`).join("\n")}

Return a JSON array and nothing else. No markdown. Start with [.
[
  { "phrase": "this is", "targetPhrase": "c'est" },
  { "phrase": "however", "targetPhrase": "cependant" }
]`;

      const raw = await callPlannerLLM(prompt);
      console.log("[GlossPlusOne:planner] Structural translation raw response:", {
        batch: `${index + 1}/${batches.length}`,
        raw,
      });

      const batchParsed = parseJsonResponse(raw) as Array<{
        phrase: string;
        targetPhrase: string;
      }>;

      if (Array.isArray(batchParsed)) {
        parsed.push(...batchParsed);
      }
    }

    if (parsed.length === 0) {
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

function getProcessedUrlStorageKey(language: string): string {
  return `${PROCESSED_URLS_KEY}:${language}`;
}

async function getProcessedUrls(language: string): Promise<Set<string>> {
  const storageKey = getProcessedUrlStorageKey(language);
  const result = await chrome.storage.local.get(PROCESSED_URLS_KEY);
  const legacy = result[PROCESSED_URLS_KEY] as string[] | undefined;
  const next = await chrome.storage.local.get(storageKey);
  return new Set((next[storageKey] as string[] | undefined) ?? legacy ?? []);
}

async function markUrlProcessed(language: string, urlHash: string): Promise<void> {
  const storageKey = getProcessedUrlStorageKey(language);
  const existing = await getProcessedUrls(language);
  existing.add(urlHash);
  const trimmed = [...existing].slice(-MAX_DISCOVERY_URLS);
  await chrome.storage.local.set({ [storageKey]: trimmed });
}

export async function clearProcessedUrls(language?: string): Promise<void> {
  if (language) {
    await chrome.storage.local.set({ [getProcessedUrlStorageKey(language)]: [] });
    return;
  }
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

function getProcessedPageKey(url: string, tier: number): string {
  return `${hashUrl(url)}::tier=${tier}`;
}

export async function runPageDiscovery(
  pageText: string,
  pageTitle: string,
  pageUrl: string,
  language: string,
): Promise<void> {
  const [bank, userContext] = await Promise.all([
    getPhraseBank(language),
    getUserContext(),
  ]);
  const processedKey = getProcessedPageKey(pageUrl, bank.currentTier);
  const processed = await getProcessedUrls(language);
  if (processed.has(processedKey)) {
    console.log("[GlossPlusOne:planner] URL already processed for current tier, skipping", {
      processedKey,
      pageUrl,
      tier: bank.currentTier,
      language,
    });
    return;
  }

  const existingPhrases = bank.phrases.map((phrase) => normalizePhraseKey(phrase.phrase));
  const existingSet = new Set(existingPhrases);
  const effectiveBand = getTierCefrBand(bank.currentTier, userContext.cefrBand);
  const nextBand = getTierCefrBand(Math.min(bank.currentTier + 1, MAX_TIER), userContext.cefrBand);

  const excerpt = pageText.slice(0, PAGE_DISCOVERY_PROMPT_MAX_CHARS);
  const promptContext: DiscoveryPromptContext = {
    pageTitle,
    language,
    nativeLanguage: userContext.nativeLanguage,
    cefrBand: userContext.cefrBand,
    currentTier: bank.currentTier,
    effectiveBand,
    nextBand,
    existingPhrases,
  };

  try {
    let parsed: DiscoveryCandidate[] = [];
    try {
      parsed = await collectGeminiDiscoveryCandidates(pageText, promptContext);
      if (parsed.length < PAGE_DISCOVERY_MIN_RESULTS) {
        console.warn("[GlossPlusOne:planner] Gemini chunked discovery returned too few phrases, trying Groq fallback", {
          count: parsed.length,
        });
        const fallbackPrompt = buildPageDiscoveryPrompt(excerpt, promptContext);
        const raw = await callGroq(fallbackPrompt);
        console.log("[GlossPlusOne:planner] Page discovery raw Groq fallback response:", raw);
        parsed = parseJsonResponse(raw) as DiscoveryCandidate[];
      }
    } catch (geminiError) {
      console.warn("[GlossPlusOne:planner] Gemini chunked discovery failed, trying Groq fallback", geminiError);
      const fallbackPrompt = buildPageDiscoveryPrompt(excerpt, promptContext);
      const raw = await callGroq(fallbackPrompt);
      console.log("[GlossPlusOne:planner] Page discovery raw Groq fallback response:", raw);
      parsed = parseJsonResponse(raw) as DiscoveryCandidate[];
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn("[GlossPlusOne:planner] Page discovery returned empty");
      await markUrlProcessed(language, processedKey);
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
      await markUrlProcessed(language, processedKey);
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
    await markUrlProcessed(language, processedKey);

    console.log(
      `[GlossPlusOne:planner] Page discovery added ${newPhrases.length} phrases`,
    );
  } catch (err) {
    console.error("[GlossPlusOne:planner] Page discovery failed:", err);
    await markUrlProcessed(language, processedKey);
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
