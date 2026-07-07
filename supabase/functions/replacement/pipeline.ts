import { Services, type Replacement } from "./types.ts";
import { Spans } from "./unit-tag/index.ts";

export async function runPipeline(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    {
        translationService,
        unitTagService,
        recoverabilityService,
    }: Services
): Promise<Replacement[]> {
    const tokens = await recoverabilityService.score(text);

    // lookup user's word bank

    const units = tokens
        .filter((t) => t.score > 0.5)
        .map((span, index) => ({ ...span, id: index }));

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
    //

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
