import type { TranslationService } from "./translate/index.ts";
import { DeepLTranslationService } from "./translate/deepl.ts";
import type { EnvType } from "./types.ts";

export interface Services {
    translationService: TranslationService;
}

export function createServices(env: EnvType): Services {
    return {
        translationService: new DeepLTranslationService(env.DEEPL_API_URL, env.DEEPL_API_KEY),
        // Other services...
    };
}
