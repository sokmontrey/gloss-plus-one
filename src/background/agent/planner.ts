import { callBackboard } from "@/background/api/backboard";
import { callGroq } from "@/background/api/groq";
import { calculateBudget } from "@/background/agent/budget";
import { buildReplacementPrompt } from "@/background/agent/prompt";
import { getPhraseState } from "@/background/memory/phraseStore";
import { getUserContext } from "@/background/memory/store";
import type { SerializablePageContent } from "@/shared/messages";
import type {
  ArticleContext,
  ExtractedParagraph,
  PhraseMemory,
  PlannedReplacement,
  ReplacementBudget,
  ReplacementManifest,
  ReplacementPlan,
  UserContext,
} from "@/shared/types";

const MODEL_USED = "groq/llama-3.3-70b-versatile";

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isArticleContext(value: unknown): value is ArticleContext {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.topic === "string" &&
    typeof value.register === "string" &&
    ["formal", "informal", "academic", "casual"].includes(value.register) &&
    typeof value.vocabularyDomain === "string" &&
    typeof value.estimatedReadingLevel === "string"
  );
}

function isPlannedReplacement(value: unknown): value is PlannedReplacement {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.targetPhrase === "string" &&
    typeof value.foreignPhrase === "string" &&
    typeof value.translation === "string" &&
    typeof value.targetLanguage === "string" &&
    typeof value.difficultyLevel === "number" &&
    typeof value.replacementType === "string" &&
    ["vocabulary", "phrase", "grammar_structure"].includes(value.replacementType) &&
    typeof value.pedagogicalReason === "string" &&
    typeof value.paragraphIndex === "number" &&
    typeof value.caseSensitive === "boolean" &&
    (typeof value.confidence === "undefined" || typeof value.confidence === "number") &&
    (typeof value.isReinforcement === "undefined" || typeof value.isReinforcement === "boolean")
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseManifest(
  raw: string,
  userContext: UserContext,
  budget: ReplacementBudget,
): ReplacementManifest {
  const normalized = stripMarkdownFences(raw);
  console.log("[GlossPlusOne:planner] Raw manifest text:", raw);
  console.log("[GlossPlusOne:planner] Normalzeda text:", normalized);
  const parsed = JSON.parse(normalized) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("MANIFEST_INVALID_TOP_LEVEL");
  }

  if (!isArticleContext(parsed.articleContext)) {
    throw new Error("MANIFEST_MISSING_ARTICLE_CONTEXT");
  }

  const rawReplacements = parsed.replacements;
  if (!Array.isArray(rawReplacements)) {
    console.warn("[GlossPlusOne:planner] Manifest missing replacements array");
    console.warn("[GlossPlusOne:planner] Parsed manifest keys:", Object.keys(parsed));

    return {
      articleContext: parsed.articleContext,
      userContext,
      budget,
      replacements: [],
      generatedAt: Date.now(),
      modelUsed: MODEL_USED,
    };
  }

  const replacements = rawReplacements.filter(isPlannedReplacement);
  if (rawReplacements.length > 0 && replacements.length === 0) {
    console.warn(
      `[GlossPlusOne:planner] Manifest replacements invalid: kept ${replacements.length} of ${rawReplacements.length}`,
    );
    console.warn("[GlossPlusOne:planner] Raw replacements:", rawReplacements);
  }

  return {
    articleContext: parsed.articleContext,
    userContext,
    budget,
    replacements,
    generatedAt: Date.now(),
    modelUsed: MODEL_USED,
  };
}

function validateManifest(
  manifest: ReplacementManifest,
  paragraphs: SerializablePageContent["paragraphs"],
): { kept: PlannedReplacement[]; discarded: number } {
  if (manifest.replacements.length === 0) {
    return { kept: [], discarded: 0 };
  }

  const validated = manifest.replacements.filter((replacement) => {
    const paragraph = paragraphs.find((candidate) => candidate.index === replacement.paragraphIndex);

    if (!paragraph) {
      console.warn(
        `[GlossPlusOne:planner] Discard — no paragraph at index ${replacement.paragraphIndex}`,
        `| available indices: ${paragraphs.map((candidate) => candidate.index).join(", ")}`,
      );
      return false;
    }

    const normalizedParagraph = normalizeText(paragraph.text);
    const normalizedPhrase = normalizeText(replacement.targetPhrase);
    const found = normalizedParagraph.includes(normalizedPhrase);

    if (!found) {
      console.warn(
        `[GlossPlusOne:planner] Discard — phrase not found: "${replacement.targetPhrase}"`,
        `\n  paragraph[${replacement.paragraphIndex}] first 100 chars: "${paragraph.text.slice(0, 100)}"`,
      );
    } else {
      console.log(
        `[GlossPlusOne:planner] Keep — "${replacement.targetPhrase}" → "${replacement.foreignPhrase}"`,
      );
    }

    return found;
  });

  if (validated.length === 0) {
    console.warn("[GlossPlusOne:planner] All replacements failed validation");
    console.warn(
      "[GlossPlusOne:planner] Paragraphs available:",
      paragraphs.map((paragraph) => ({ index: paragraph.index, preview: paragraph.text.slice(0, 60) })),
    );
    return { kept: [], discarded: manifest.replacements.length };
  }

  return { kept: validated, discarded: manifest.replacements.length - validated.length };
}

function groupByParagraph(
  replacements: PlannedReplacement[],
  paragraphs: SerializablePageContent["paragraphs"],
): ReplacementPlan[] {
  const paragraphLookup = new Map(paragraphs.map((paragraph) => [paragraph.index, paragraph.text]));
  const grouped = new Map<number, PlannedReplacement[]>();

  for (const replacement of replacements) {
    const existing = grouped.get(replacement.paragraphIndex);

    if (existing) {
      existing.push(replacement);
      continue;
    }

    grouped.set(replacement.paragraphIndex, [replacement]);
  }

  return [...grouped.entries()]
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .map(([paragraphIndex, paragraphReplacements]) => ({
      paragraphIndex,
      originalText: paragraphLookup.get(paragraphIndex) ?? "",
      replacements: paragraphReplacements,
    }));
}

function buildSeenPhraseReplacements(
  paragraphs: SerializablePageContent["paragraphs"],
  seenPhrases: PhraseMemory[],
): PlannedReplacement[] {
  const results: PlannedReplacement[] = [];

  for (const paragraph of paragraphs) {
    const normalizedText = paragraph.text.toLowerCase();

    for (const seen of seenPhrases) {
      const normalizedPhrase = seen.phrase.toLowerCase().trim();
      if (!normalizedText.includes(normalizedPhrase)) continue;

      const regex = new RegExp(`\\b${escapeRegExp(normalizedPhrase)}\\b`, "i");
      if (!regex.test(paragraph.text)) continue;

      results.push({
        targetPhrase: seen.phrase,
        foreignPhrase: seen.targetPhrase,
        translation: seen.phrase,
        targetLanguage: seen.targetLanguage,
        difficultyLevel: 1,
        replacementType: seen.phraseType === "structural" ? "grammar_structure" : "vocabulary",
        pedagogicalReason: `reinforcement - confidence ${(seen.confidence * 100).toFixed(0)}%`,
        paragraphIndex: paragraph.index,
        caseSensitive: false,
        confidence: seen.confidence,
        isReinforcement: true,
      });
    }
  }

  return results;
}

function filterNewReplacements(
  replacements: PlannedReplacement[],
  seenReplacements: PlannedReplacement[],
  budget: ReplacementBudget,
): PlannedReplacement[] {
  const seenPhraseKeys = new Set(
    seenReplacements.map(
      (replacement) => `${replacement.paragraphIndex}:${replacement.targetPhrase.toLowerCase().trim()}`,
    ),
  );
  const seenCounts = new Map<number, number>();
  for (const replacement of seenReplacements) {
    seenCounts.set(replacement.paragraphIndex, (seenCounts.get(replacement.paragraphIndex) ?? 0) + 1);
  }

  const perParagraphAdded = new Map<number, number>();
  const kept: PlannedReplacement[] = [];

  for (const replacement of replacements) {
    const phraseKey = `${replacement.paragraphIndex}:${replacement.targetPhrase.toLowerCase().trim()}`;
    if (seenPhraseKeys.has(phraseKey)) {
      continue;
    }

    const seenCount = seenCounts.get(replacement.paragraphIndex) ?? 0;
    const alreadyAdded = perParagraphAdded.get(replacement.paragraphIndex) ?? 0;
    const paragraphBudget = budget.perParagraph[replacement.paragraphIndex] ?? 0;
    const remaining = Math.max(0, paragraphBudget - seenCount);
    if (alreadyAdded >= remaining) {
      continue;
    }

    perParagraphAdded.set(replacement.paragraphIndex, alreadyAdded + 1);
    kept.push({ ...replacement, isReinforcement: false });
  }

  return kept;
}

async function discoverNewPhrases(
  content: SerializablePageContent,
  userContext: UserContext,
  seenPhrases: PhraseMemory[],
  budget: ReplacementBudget,
): Promise<PlannedReplacement[]> {
  const prompt = buildReplacementPrompt(
    content.paragraphs,
    userContext,
    {
      title: content.title,
      domain: content.domain,
      pageType: content.pageType,
    },
    budget,
    seenPhrases,
  );

  void callBackboard;
  console.log("[GlossPlusOne:planner] Groq call started");
  const startedAt = Date.now();
  const rawResponse = await callGroq(prompt);
  console.log(`[GlossPlusOne:planner] Groq responded — ${Date.now() - startedAt}ms`);

  const manifest = parseManifest(rawResponse, userContext, budget);
  const { kept, discarded } = validateManifest(manifest, content.paragraphs);
  console.log(`[GlossPlusOne:planner] Validated: ${kept.length} kept, ${discarded} discarded`);
  return kept;
}

export async function buildReplacementPlans(
  content: SerializablePageContent,
): Promise<ReplacementPlan[]> {
  try {
    console.log(
      `[GlossPlusOne:planner] REQUEST received - ${content.paragraphs.length} paragraphs, ${content.pageType}, ${content.domain}`,
    );

    if (content.paragraphs.length === 0) {
      console.warn("[GlossPlusOne:planner] No paragraphs available; skipping plan build");
      return [];
    }

    const [userContext, phraseState] = await Promise.all([getUserContext(), getPhraseState()]);
    const seenPhrases = phraseState.seenPhrases.filter(
      (phrase) => phrase.targetLanguage === userContext.targetLanguage,
    );
    const extractedParagraphs = content.paragraphs as unknown as ExtractedParagraph[];
    const budget = calculateBudget(extractedParagraphs, userContext);
    console.log(`[GlossPlusOne:planner] Budget: ${budget.totalBudget} total replacements`);

    const seenReplacements = buildSeenPhraseReplacements(content.paragraphs, seenPhrases);
    const seenCountByParagraph = new Map<number, number>();
    for (const replacement of seenReplacements) {
      seenCountByParagraph.set(
        replacement.paragraphIndex,
        (seenCountByParagraph.get(replacement.paragraphIndex) ?? 0) + 1,
      );
    }
    const remainingBudget = Object.entries(budget.perParagraph).reduce((sum, [paragraphIndex, limit]) => {
      return sum + Math.max(0, limit - (seenCountByParagraph.get(Number(paragraphIndex)) ?? 0));
    }, 0);
    const discoveredReplacements =
      remainingBudget > 0 ? await discoverNewPhrases(content, userContext, seenPhrases, budget) : [];
    const newReplacements = filterNewReplacements(discoveredReplacements, seenReplacements, budget);
    const plans = groupByParagraph([...seenReplacements, ...newReplacements], content.paragraphs);
    console.log(`[GlossPlusOne:planner] PLAN_READY - ${plans.length} ReplacementPlans`);

    return plans;
  } catch (error) {
    console.warn("[GlossPlusOne:planner] Failed to build replacement plans", error);
    return [];
  }
}
