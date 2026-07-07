import type { TranslationService } from "./translate/index.ts";
import { DeepLTranslationService } from "./translate/deepl.ts";
import type { UnitTagService } from "./unit-tag/index.ts";
import { XmlUnitTagService } from "./unit-tag/xml.ts";
import type { EnvType } from "./types.ts";

export interface Services {
    translationService: TranslationService;
    unitTagService: UnitTagService;
}

export function createServices(env: EnvType): Services {
    return {
        translationService: new DeepLTranslationService(
            env.SB_TRANSLATE_DEEPL_API_URL,
            env.SB_TRANSLATE_DEEPL_API_KEY
        ),
        unitTagService: new XmlUnitTagService(),
        // Other services...
    };
}
