import { LanguageCode } from '../types'

export interface TranslationService {
    translate(
        sourceText: string[],
        sourceLanguage: LanguageCode,
        targetLanguage: LanguageCode
    ): Promise<string[]>;
}
