import { type LanguageCode, Services, type Replacement, type ReplacementItem, type ReplacementResult } from "./types.ts";
import { accumulateUnitScores, mergeAdjacentUnits, type ReplacableSegment } from "./units.ts";

const REPLACEMENT_THRESHOLD = 0.5;

interface PreparedText {
    taggedText: string;
    replacableSegments: ReplacableSegment[];
}

/**
 * Recoverability scoring + unit tagging for a single piece of text. This is
 * local work (aside from the recoverability service call) — it doesn't talk
 * to the translation provider, so it's safe to do per item.
 */
async function prepareText(
    text: string,
    { unitTagService, recoverabilityService }: Services,
): Promise<PreparedText> {
    const tokens = await recoverabilityService.score(text);

    const units = accumulateUnitScores(text, tokens);
    const replacableUnits = units
        .filter((x) => x.score > REPLACEMENT_THRESHOLD)
        .map((x, index) => ({ ...x, id: index }));

    const replacableSegments = mergeAdjacentUnits(text, replacableUnits);
    const taggedText = unitTagService.insert(text, replacableSegments);

    return { taggedText, replacableSegments };
}

function buildReplacements(
    originalText: string,
    translatedText: string,
    replacableSegments: ReplacableSegment[],
    unitTagService: Services["unitTagService"],
): Replacement[] {
    const extractedSpans = unitTagService.extract(translatedText, replacableSegments);
    const scoreById = new Map<number, number>(
        replacableSegments.map((s) => [s.id, s.score]),
    );

    return extractedSpans.map((span) => ({
        start: span.start,
        end: span.end,
        original: originalText.slice(span.start, span.end),
        replacement: span.text,
        score: scoreById.get(span.id),
    }));
}

export async function runPipeline(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    services: Services,
): Promise<Replacement[]> {
    const { taggedText, replacableSegments } = await prepareText(text, services);

    const [translatedText] = await services.translationService.translate(
        [taggedText],
        sourceLanguage,
        targetLanguage,
    );

    return buildReplacements(text, translatedText, replacableSegments, services.unitTagService);
}

/**
 * Runs the whole batch through the pipeline, but — unlike calling
 * `runPipeline` once per item — every item's tagged text is handed to the
 * translation service together, as a single call. Scoring/tagging is still
 * done per item (cheap, local), but that single combined call is what
 * actually determines how many requests hit the translation provider: one
 * per batch instead of one per item, however large the batch is.
 *
 * Each item is still isolated on failure: if scoring/tagging blows up for
 * one item, only that item gets an `error`. If the shared translation call
 * itself fails (e.g. rate limited), every item that was relying on it gets
 * the same `error`, since there's nothing to fall back to.
 */
export async function runPipelineBatch(
    items: ReplacementItem[],
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    services: Services,
): Promise<ReplacementResult[]> {
    const { translationService, unitTagService } = services;

    const prepared = await Promise.all(
        items.map(async (item) => {
            try {
                return { item, prepared: await prepareText(item.text, services), error: undefined };
            } catch (e) {
                console.error(`pipeline prep error for item ${item.id}:`, e);
                return { item, prepared: undefined, error: String(e) };
            }
        }),
    );

    const translatable = prepared.filter(
        (p): p is { item: ReplacementItem; prepared: PreparedText; error: undefined } =>
            p.prepared !== undefined,
    );

    let translatedTexts: string[] = [];
    let translationError: string | undefined;

    if (translatable.length > 0) {
        try {
            console.log(`Translating ${translatable.length} item(s) in a single request`);
            translatedTexts = await translationService.translate(
                translatable.map((p) => p.prepared.taggedText),
                sourceLanguage,
                targetLanguage,
            );
        } catch (e) {
            console.error("batched translation error:", e);
            translationError = String(e);
        }
    }

    const resultById = new Map<string, ReplacementResult>();

    for (const p of prepared) {
        if (p.error !== undefined) {
            resultById.set(p.item.id, { id: p.item.id, replacements: [], error: p.error });
        }
    }

    translatable.forEach((p, i) => {
        if (translationError !== undefined) {
            resultById.set(p.item.id, { id: p.item.id, replacements: [], error: translationError });
            return;
        }

        try {
            const replacements = buildReplacements(
                p.item.text,
                translatedTexts[i],
                p.prepared.replacableSegments,
                unitTagService,
            );
            resultById.set(p.item.id, { id: p.item.id, replacements });
        } catch (e) {
            console.error(`pipeline extract error for item ${p.item.id}:`, e);
            resultById.set(p.item.id, { id: p.item.id, replacements: [], error: String(e) });
        }
    });

    return items.map(
        (item) =>
            resultById.get(item.id) ?? {
                id: item.id,
                replacements: [],
                error: "unknown pipeline error",
            },
    );
}
