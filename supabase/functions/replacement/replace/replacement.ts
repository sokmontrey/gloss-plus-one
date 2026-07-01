import type { ScoredLexicon } from "../recoverablity/index.ts";
import type { TranslationItem } from "../translation/index.ts";
import type { Replacement } from "../types.ts";
import type { ReplacementService } from "./index.ts";

const DEFAULT_SCORE_THRESHOLD = 0.85;

export class ReplacementClass implements ReplacementService {
  private scoreThreshold: number;

  constructor(scoreThreshold = DEFAULT_SCORE_THRESHOLD) {
    this.scoreThreshold = scoreThreshold;
  }

  buildReplacements(
    scoredLexicons: ScoredLexicon[],
    translations: TranslationItem[],
  ): Replacement[] {
    const translationById = new Map<number, string | null>(
      translations.map((translation) => [translation.id, translation.target]),
    );

    const replacements: Replacement[] = [];

    for (const lex of scoredLexicons) {
      if (lex.score === null || lex.score < this.scoreThreshold) {
        continue;
      }

      const target = translationById.get(lex.id);
      if (!target) {
        continue;
      }

      replacements.push({
        start: lex.start,
        end: lex.end,
        original: lex.text,
        replacement: target,
        score: lex.score,
      });
    }

    return replacements;
  }
}
