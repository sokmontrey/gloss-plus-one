import type { Replacement } from "./types.ts";
import type { LexiconService } from "./lexicon/index.ts";
import type { TranslationService } from "./translation/index.ts";
import type { RecoverablityService } from "./recoverablity/index.ts";
import type { ReplacementService } from "./replace/index.ts";

export async function runPipeline(
  text: string,
  targetLanguage: string,
  services: {
    lexicon: LexiconService;
    translation: TranslationService;
    recoverability: RecoverablityService;
    replacement: ReplacementService;
  },
): Promise<Replacement[]> {
  // const t0 = Date.now();

  // // Step 1: get candidate lexicons
  // const candidates = await services.lexicon.getReplaceableLexicons(text);
  // console.info(
  //   `[pipeline] lexicons: ${Date.now() - t0}ms (${candidates.length} candidates)`,
  // );

  // if (candidates.length === 0) return [];

  // // Step 2: MLM (only function word positions) + translation in parallel.
  // const t1 = Date.now();
  // const [translations, scoredLexicons] = await Promise.all([
  //   services.translation.translateLexicons(text, candidates, targetLanguage),
  //   services.recoverability.score(text),
  // ]);
  // console.info(`[pipeline] mlm+translate: ${Date.now() - t1}ms`);

  // // Step 3: filter and build replacements
  // const replacements = services.replacement.buildReplacements(
  //   scoredLexicons,
  //   translations,
  // );

  // console.info(
  //   `[pipeline] total: ${Date.now() - t0}ms → ${replacements.length} replacements`,
  // );
  return replacements;
}
