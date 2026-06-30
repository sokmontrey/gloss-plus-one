import type { ScoredLexicon } from "../recoverablity/index.ts";
import type { TranslationItem } from "../translation/index.ts";
import type { Replacement } from "../types.ts";

export interface ReplacementService {
  buildReplacements(
    scoredLexicons: ScoredLexicon[],
    translations: TranslationItem[],
  ): Replacement[];
}
