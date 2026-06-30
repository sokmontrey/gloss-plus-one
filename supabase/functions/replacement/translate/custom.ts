import { LanguageCode } from "../types";
import { TranslationService } from "./";

interface CustomTranslateResponse {
    translations: string[];
}

const languageCodeMap: Record<LanguageCode, string> = {
    en: 'en',
    pt: 'pt',
};

export class CustomTranslationService implements TranslationService {
    private readonly apiUrl: string;

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl;
    }

    async translate(
        sourceText: string[],
        sourceLanguage: LanguageCode,
        targetLanguage: LanguageCode
    ): Promise<string[]> {
        const mappedSourceLanguage = languageCodeMap[sourceLanguage];
        const mappedTargetLanguage = languageCodeMap[targetLanguage];


        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: [ sourceText ],
                sourceLanguage: mappedSourceLanguage,
                targetLanguage: mappedTargetLanguage,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json() as CustomTranslateResponse;
        return data.translations;
    }
}
