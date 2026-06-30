import type { Lexicon } from "../lexicon/index.ts";

export interface TranslationItem {
  id: number;
  source: string;
  target: string | null;
}

export interface TranslationService {
  translateLexicons(
    text: string,
    lexicons: Lexicon[],
    targetLang: string,
  ): Promise<TranslationItem[]>;
}
