import type { ExtractedParagraph, PageContent, ReplacementBudget, UserContext } from "@/shared/types";

function formatKnownPhrases(knownPhrases: string[]): string {
  if (knownPhrases.length === 0) {
    return "[]";
  }

  return JSON.stringify(knownPhrases);
}

function formatParagraphBudgets(budget: ReplacementBudget): string {
  return Object.entries(budget.perParagraph)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([paragraphIndex, limit]) => `- Paragraph ${paragraphIndex}: ${limit}`)
    .join("\n");
}

function formatParagraphs(paragraphs: ExtractedParagraph[]): string {
  return paragraphs.map((paragraph) => `[${paragraph.index}] ${paragraph.text}`).join("\n");
}

export function buildReplacementPrompt(
  paragraphs: ExtractedParagraph[],
  userContext: UserContext,
  pageContext: Pick<PageContent, "title" | "domain" | "pageType">,
  budget: ReplacementBudget,
): string {
  const immersionPercentage = Math.round(userContext.immersionIntensity * 100);

  return [
    "SECTION 1 - ROLE",
    `You are a language acquisition assistant implementing Krashen's i+1 principle. Your job is to identify phrases in the article below that can be replaced with ${userContext.targetLanguage} equivalents at exactly one level above the learner's current ceiling. You output a structured JSON plan. You do NOT modify text. You identify targets and their replacements.`,
    "",
    "SECTION 2 - LEARNER PROFILE",
    `cefrBand: ${userContext.cefrBand}`,
    `cefrConfidence: ${userContext.cefrConfidence}`,
    `targetLanguage: ${userContext.targetLanguage}`,
    `knownPhrases: ${formatKnownPhrases(userContext.knownPhrases)}`,
    `sessionFatigueSignal: ${userContext.sessionFatigueSignal}`,
    `immersionIntensity: ${immersionPercentage}%`,
    "",
    "SECTION 3 - ARTICLE CONTEXT",
    `title: ${pageContext.title}`,
    `domain: ${pageContext.domain}`,
    `pageType: ${pageContext.pageType}`,
    "",
    "SECTION 4 - REPLACEMENT BUDGET",
    formatParagraphBudgets(budget),
    `totalBudget: ${budget.totalBudget}`,
    `maxPhrasesPerParagraph: ${budget.maxPhrasesPerParagraph}`,
    `maxConsecutiveReplaced: ${budget.maxConsecutiveReplaced}`,
    "Hard rules:",
    "- max 2 phrases per paragraph",
    "- never two replaced phrases in adjacent positions",
    "- never replace proper nouns or URLs",
    "",
    "SECTION 5 - PHRASE CONSTRAINTS",
    "- targetPhrase must be copied VERBATIM from the source paragraph",
    "- Max phrase length: 3 words",
    "- Prefer nouns, adjective-noun pairs, or common verb phrases",
    "- Never cross sentence boundaries",
    "- If no good replacement exists for a paragraph, return empty array for that paragraph - do NOT invent one",
    "- Validate: targetPhrase must appear literally in the paragraph text",
    "",
    "SECTION 6 - OUTPUT FORMAT",
    'Return ONLY a valid JSON object matching this exact shape:',
    "{",
    '  "articleContext": {',
    '    "topic": "...",',
    '    "register": "formal|informal|academic|casual",',
    '    "vocabularyDomain": "...",',
    '    "estimatedReadingLevel": "..."',
    "  },",
    '  "replacements": [',
    "    {",
    '      "targetPhrase": "exact phrase from source",',
    '      "foreignPhrase": "target language phrase",',
    '      "translation": "english gloss",',
    `      "targetLanguage": "${userContext.targetLanguage}",`,
    '      "difficultyLevel": 3,',
    '      "replacementType": "vocabulary",',
    '      "pedagogicalReason": "brief reason",',
    '      "paragraphIndex": 0,',
    '      "caseSensitive": false',
    "    }",
    "  ]",
    "}",
    "No markdown. No explanation. No code fences. Only the JSON object.",
    "",
    "SECTION 7 - PARAGRAPHS",
    formatParagraphs(paragraphs),
  ].join("\n");
}
