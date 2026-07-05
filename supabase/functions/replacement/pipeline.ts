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

    const { translationService, unitTagService } = createServices(envParseResult.data);

    const spans = [{ start: 4, end: 7, value: "cat" }];
    const units = spans.map((span, index) => ({ ...span, id: index }));

    const taggedText = unitTagService.insert(text, units);

    const translatedText = (await translationService.translate(
        [taggedText],
        sourceLanguage,
        targetLanguage,
    ))[0];

    const extractedSpans = unitTagService.extract(translatedText, units);

    console.log(extractedSpans);

    // ...
    // Other modules and steps
    // ...

    return [
        {
            start: 0,
            end: translatedText[0].length,
            original: text,
            replacement: translatedText[0],
            score: undefined,
        },
    ];
}
