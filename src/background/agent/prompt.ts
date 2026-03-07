import type { SerializableParagraph } from "@/shared/messages";
import type { PageContent, PhraseMemory, ReplacementBudget, UserContext } from "@/shared/types";

function formatSeenPhrases(seenPhrases: PhraseMemory[]): string {
  if (seenPhrases.length === 0) {
    return "  none yet — this is the user's first session";
  }

  return seenPhrases
    .map(
      (phrase) =>
        `  "${phrase.phrase}" → "${phrase.targetPhrase}" (confidence: ${(phrase.confidence * 100).toFixed(0)}%)`,
    )
    .join("\n");
}

function formatBudgetLines(budget: ReplacementBudget): string {
  return Object.entries(budget.perParagraph)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([paragraphIndex, limit]) => `  [PARAGRAPH ${paragraphIndex}]: up to ${limit} NEW phrases`)
    .join("\n");
}

function formatParagraphs(paragraphs: SerializableParagraph[]): string {
  return paragraphs.map((paragraph) => `[PARAGRAPH ${paragraph.index}]\n${paragraph.text}`).join("\n\n---\n\n");
}

function getLearnerPhase(userContext: UserContext): "structural" | "lexical" {
  if (userContext.cefrBand === "A1" || userContext.cefrBand === "A2") {
    return "structural";
  }

  return "lexical";
}

export function buildReplacementPrompt(
  paragraphs: SerializableParagraph[],
  userContext: UserContext,
  pageContext: Pick<PageContent, "title" | "domain" | "pageType">,
  budget: ReplacementBudget,
  seenPhrases: PhraseMemory[],
): string {
  const phase = getLearnerPhase(userContext);

  return `
You are a language acquisition assistant using the Lexical Approach
(Michael Lewis). Your job is to select phrases from the article text
to replace with ${userContext.targetLanguage} equivalents, following
Krashen's i+1 principle.

LEARNER PROFILE:
- Native language: ${userContext.nativeLanguage}
- Target language: ${userContext.targetLanguage}
- CEFR level: ${userContext.cefrBand} (${userContext.cefrConfidence}% confidence)
- Learning phase: ${phase === "structural" ? "STRUCTURAL — learning grammar patterns through chunks" : "LEXICAL — expanding vocabulary and collocations"}
- Fatigue: ${userContext.sessionFatigueSignal ? "YES — reduce count by 50%" : "no"}

PHRASES USER ALREADY KNOWS (DO NOT suggest these — they are handled
automatically by a separate system. You only discover NEW phrases):
${formatSeenPhrases(seenPhrases)}

PAGE CONTEXT:
- Title: ${pageContext.title}
- Domain: ${pageContext.domain}
- Type: ${pageContext.pageType}

REPLACEMENT BUDGET (new phrases only, seen phrases are added separately):
${formatBudgetLines(budget)}

${phase === "structural"
    ? `
STRUCTURAL PHASE INSTRUCTIONS:
The learner needs to internalize grammar patterns through formulaic chunks.
Target multi-word structural units that demonstrate grammar, NOT content words.

Good structural targets (examples — apply to ${userContext.targetLanguage}):
  - Copula constructions: "this is", "that is", "it is", "these are"
  - Existential frames: "there is", "there are", "there has been"
  - Question formations: "what is", "how does", "why are"
  - Discourse connectors: "however", "therefore", "in addition",
    "as a result", "even though", "in order to", "on the other hand"
  - Modal phrases: "is able to", "tends to", "is likely to"
  - Purpose/cause: "because of", "due to", "so that"

Replacement strategy: replace ONLY the structural chunk, keep all
content words in English. The familiar content makes the foreign
structure transparent.
  Example: "This is important" → "Esto es important"
                                   ↑↑↑↑↑↑↑ only this changes

Prioritize chunks that appear multiple times in the text — these
give more reinforcement opportunities per session.
`
    : `
LEXICAL PHASE INSTRUCTIONS:
The learner has solid structural foundations. Target content vocabulary
that expands their expressive range.

Good lexical targets:
  - Domain collocations (verb+noun pairs): "raises concerns",
    "significant impact", "plays a role"
  - Adjective-noun pairs: "fundamental principles", "complex system"
  - Near-synonyms at B1-B2 level
  - Register markers appropriate to this text type (${pageContext.pageType})
  - Idiomatic multi-word expressions

Avoid bare single nouns — prefer phrases that show how words collocate.
`}

CRITICAL PHRASE RULES:
- targetPhrase must be copied CHARACTER-FOR-CHARACTER from the paragraph
- It must pass String.includes() against the exact paragraph text shown
- Max 3 words per phrase
- Never cross sentence boundaries
- Do not suggest phrases already in the known list above
- Generate the foreignPhrase naturally for ${userContext.targetLanguage}
  (use the most natural, commonly used equivalent — not literal translation)

PARAGRAPH TEXT (exact — copy targetPhrases verbatim from here):
${formatParagraphs(paragraphs)}

Return ONLY a valid JSON object. No markdown. No explanation.
{
  "articleContext": {
    "topic": "...",
    "register": "formal|informal|academic|casual",
    "vocabularyDomain": "...",
    "estimatedReadingLevel": "..."
  },
  "replacements": [
    {
      "targetPhrase": "exact phrase from paragraph",
      "foreignPhrase": "natural ${userContext.targetLanguage} equivalent",
      "translation": "english meaning",
      "targetLanguage": "${userContext.targetLanguage}",
      "difficultyLevel": 1,
      "replacementType": "grammar_structure|vocabulary|phrase",
      "pedagogicalReason": "why this phrase for this learner",
      "paragraphIndex": 0,
      "caseSensitive": false
    }
  ]
}
`.trim();
}
