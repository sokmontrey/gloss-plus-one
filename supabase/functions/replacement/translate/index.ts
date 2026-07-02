import { LanguageCode } from "../types.ts";

export interface TranslationService {
    translate(
        sourceText: string[],
        sourceLanguage: LanguageCode,
        targetLanguage: LanguageCode,
    ): Promise<string[]>;
}
