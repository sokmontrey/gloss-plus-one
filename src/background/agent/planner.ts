import { callBackboard } from "@/background/api/backboard";
import { calculateBudget } from "@/background/agent/budget";
import { buildReplacementPrompt } from "@/background/agent/prompt";
import { getUserContext } from "@/background/memory/store";
import type { SerializablePageContent } from "@/shared/messages";
import type {
  ArticleContext,
  ExtractedParagraph,
  PlannedReplacement,
  ReplacementBudget,
  ReplacementManifest,
  ReplacementPlan,
  UserContext,
} from "@/shared/types";

const MODEL_USED = "backboard/gemini-2.0-flash";

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
    typeof value.caseSensitive === "boolean"
  );
}

function parseManifest(
  raw: string,
  userContext: UserContext,
  budget: ReplacementBudget,
): ReplacementManifest {
  const normalized = stripMarkdownFences(raw);
  const parsed = JSON.parse(normalized) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("MANIFEST_INVALID_TOP_LEVEL");
  }

  if (!isArticleContext(parsed.articleContext)) {
    throw new Error("MANIFEST_MISSING_ARTICLE_CONTEXT");
  }

  if (!Array.isArray(parsed.replacements) || !parsed.replacements.every(isPlannedReplacement)) {
    throw new Error("MANIFEST_MISSING_REPLACEMENTS");
  }

  return {
    articleContext: parsed.articleContext,
    userContext,
    budget,
    replacements: parsed.replacements,
    generatedAt: Date.now(),
    modelUsed: MODEL_USED,
  };
}

function validateManifest(
  manifest: ReplacementManifest,
  paragraphs: SerializablePageContent["paragraphs"],
): { kept: PlannedReplacement[]; discarded: number } {
  const paragraphByIndex = new Map(paragraphs.map((paragraph) => [paragraph.index, paragraph]));
  const kept: PlannedReplacement[] = [];
  let discarded = 0;

  for (const replacement of manifest.replacements) {
    const paragraph = paragraphByIndex.get(replacement.paragraphIndex);
    const paragraphText = paragraph?.text ?? "";
    const found = paragraphText.toLowerCase().includes(replacement.targetPhrase.toLowerCase());

    if (!found) {
      discarded += 1;
      console.warn("[GlossPlusOne:planner] Discarded invalid replacement", replacement);
      continue;
    }

    kept.push(replacement);
  }

  return { kept, discarded };
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

export async function buildReplacementPlans(
  content: SerializablePageContent,
): Promise<ReplacementPlan[]> {
  try {
    console.log(
      `[GlossPlusOne:planner] REQUEST received - ${content.paragraphs.length} paragraphs, ${content.pageType}, ${content.domain}`,
    );

    const userContext = await getUserContext();
    const extractedParagraphs = content.paragraphs as unknown as ExtractedParagraph[];
    const budget = calculateBudget(extractedParagraphs, userContext);
    console.log(`[GlossPlusOne:planner] Budget: ${budget.totalBudget} total replacements`);

    const prompt = buildReplacementPrompt(
      extractedParagraphs,
      userContext,
      {
        title: content.title,
        domain: content.domain,
        pageType: content.pageType,
      },
      budget,
    );

    console.log("[GlossPlusOne:planner] Gemini call started");
    const startedAt = Date.now();
    const rawResponse = await callBackboard(prompt);
    console.log(`[GlossPlusOne:planner] Backboard responded — ${Date.now() - startedAt}ms`);

    const manifest = parseManifest(rawResponse, userContext, budget);
    const { kept, discarded } = validateManifest(manifest, content.paragraphs);
    console.log(`[GlossPlusOne:planner] Validated: ${kept.length} kept, ${discarded} discarded`);

    const plans = groupByParagraph(kept, content.paragraphs);
    console.log(`[GlossPlusOne:planner] PLAN_READY - ${plans.length} ReplacementPlans`);

    return plans;
  } catch (error) {
    console.warn("[GlossPlusOne:planner] Failed to build replacement plans", error);
    return [];
  }
}
