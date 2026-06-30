import { LanguageCode } from "../types";
import { TranslationService } from "./";

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
        this.apiUrl = apiUrl || "https://api.deepl.com/v2/translate";
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
                text: [sourceText],
                source_lang: mappedSourceLanguage,
                target_lang: mappedTargetLanguage,
            }),
        });
        const data = await response.json();
        return data.translations.map((x: DeepLTranslatedUnit) => x.text);
    }
}
