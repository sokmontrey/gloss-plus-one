import { EnvSchema, EnvType, type Replacement } from "./types.ts";
import { createServices } from "./servicesFactory.ts";

export async function runPipeline(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
): Promise<Replacement[]> {
    const envParseResult = EnvSchema.safeParse(Deno.env.toObject());

    if (!envParseResult.success) {
        throw new Error("Invalid environment variables");
    }

    const { translationService } = createServices(envParseResult.data);

    const translatedText = await translationService.translate([text], sourceLanguage, targetLanguage);

    // ...
    // Other modules and steps
    // ...

    return [{
        start: 0,
        end: translatedText[0].length,
        original: text,
        replacement: translatedText[0],
        score: undefined,
    }];
}
