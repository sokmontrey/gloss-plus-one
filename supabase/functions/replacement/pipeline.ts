import { type LanguageCode, Services, type Replacement, type ReplacementItem, type ReplacementResult } from "./types.ts";
import { accumulateUnitScores, mergeAdjacentUnits } from "./units.ts";

const REPLACEMENT_THRESHOLD = 0.8;

// How many items of a batch are run through the pipeline concurrently.
// Keeping this bounded (rather than firing every item at once) reduces the
// odds of tripping a downstream provider's rate limit, since each item ends
// up making its own translation call.
const PIPELINE_BATCH_CONCURRENCY = 3;

export async function runPipeline(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    {
        translationService,
        unitTagService,
        recoverabilityService,
    }: Services
): Promise<Replacement[]> {
    const tokens = await recoverabilityService.score(text);

    // lookup user's word bank

    const units = accumulateUnitScores(text, tokens);
    const replacableUnits = units
        .filter((x) => x.score > REPLACEMENT_THRESHOLD)
        .map((x, index) => ({ ...x, id: index }));

    const replacableSegments = mergeAdjacentUnits(text, replacableUnits);

    const taggedText = unitTagService.insert(text, replacableSegments);

    const translatedText = await translationService.translate(
        [taggedText],
        sourceLanguage,
        targetLanguage,
    ).then(([first]) => first);

    const extractedSpans = unitTagService.extract(translatedText, replacableSegments);

    const scoreById = new Map<number, number>(
        replacableSegments.map((s) => [s.id, s.score]),
    );

    return extractedSpans.map((span) => ({
        start: span.start,
        end: span.end,
        original: text.slice(span.start, span.end),
        replacement: span.text,
        score: scoreById.get(span.id),
    }));
}

/**
 * Runs `runPipeline` for every item in a batch, with bounded concurrency.
 *
 * Each item is isolated: a failure on one item is captured as `error` on its
 * result instead of rejecting the whole batch, so a single bad/rate-limited
 * item doesn't take down every other item in the same request.
 */
export async function runPipelineBatch(
    items: ReplacementItem[],
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    services: Services,
): Promise<ReplacementResult[]> {
    const results: ReplacementResult[] = new Array(items.length);

    let nextIndex = 0;
    async function worker(): Promise<void> {
        while (true) {
            const i = nextIndex++;
            if (i >= items.length) return;

            const item = items[i];
            try {
                const replacements = await runPipeline(
                    item.text,
                    sourceLanguage,
                    targetLanguage,
                    services,
                );
                results[i] = { id: item.id, replacements };
            } catch (e) {
                console.error(`pipeline error for item ${item.id}:`, e);
                results[i] = { id: item.id, replacements: [], error: String(e) };
            }
        }
    }

    const workerCount = Math.min(PIPELINE_BATCH_CONCURRENCY, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    return results;
}
