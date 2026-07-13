import type { LanguageCode } from "../types.ts";
import type { TranslationService } from "./index.ts";

interface DeepLTranslatedUnit {
    text: string;
    detected_source_language: string;
}

interface DeepLResponse {
    translations: DeepLTranslatedUnit[];
}

const languageCodeMap: Record<LanguageCode, string> = {
    en: "EN",
    pt: "PT-BR",
};

export class DeepLTranslationService implements TranslationService {
    private readonly apiUrl: string;
    private readonly apiKey: string;

    constructor(apiUrl: string, apiKey: string) {
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
    }

    async translate(
        sourceText: string[],
        sourceLanguage: LanguageCode,
        targetLanguage: LanguageCode,
    ): Promise<string[]> {
        const mappedSourceLanguage = languageCodeMap[sourceLanguage];
        const mappedTargetLanguage = languageCodeMap[targetLanguage];

        const response = await fetch(this.apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `DeepL-Auth-Key ${this.apiKey}`,
            },
            body: JSON.stringify({
                text: sourceText,
                source_lang: mappedSourceLanguage,
                target_lang: mappedTargetLanguage,
                tag_handling: "xml",
                tag_handling_version: "v2",
            }),
        });

        if (!response.ok) {
            const bodyText = await response.text();
            throw new Error(`DeepL API error: ${response.status} ${bodyText}`);
        }

        const data = (await response.json()) as DeepLResponse;
        return data.translations.map((x: DeepLTranslatedUnit) => x.text);
    }
}
