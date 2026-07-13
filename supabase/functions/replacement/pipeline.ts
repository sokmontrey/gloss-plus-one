import type { LanguageCode, Replacement, ReplacementItem, ReplacementResult } from "./types.ts";
import type { TranslationService } from "./translate/index.ts";
import type { RecoverabilityService } from "./recoverability/index.ts";
import { accumulateUnitScores, mergeAdjacentUnits } from "./utils/units.ts";
import { insertUnitTags, extractUnitTags } from "./utils/unit-tag.ts";

// The pipeline's dependency-injection contract: only backends that wrap
// external I/O with swappable config belong here. unit-tag has neither (no
// I/O, no config, one implementation), so it's called directly as a
// function instead of being injected through this bag.
export interface Services {
    translationService: TranslationService,
    recoverabilityService: RecoverabilityService,
}

// TODO: Read this from users table instead
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
    { translationService, recoverabilityService }: Services,
): Promise<Replacement[]> {
    const tokens = await recoverabilityService.score(text);

    // TODO(word-bank): once a per-user word bank exists, filter units the
    // user already knows out of `replaceableUnits` before merging/tagging.

    const units = accumulateUnitScores(text, tokens);
    const replaceableUnits = units
        .filter((x) => x.score > REPLACEMENT_THRESHOLD)
        .map((x, index) => ({ ...x, id: index }));

    const replaceableSegments = mergeAdjacentUnits(text, replaceableUnits);

    const taggedText = insertUnitTags(text, replaceableSegments);

    const translatedText = await translationService.translate(
        [taggedText],
        sourceLanguage,
        targetLanguage,
    ).then(([first]) => first);

    const extractedSpans = extractUnitTags(translatedText, replaceableSegments);

    const scoreById = new Map<number, number>(
        replaceableSegments.map((s) => [s.id, s.score]),
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
