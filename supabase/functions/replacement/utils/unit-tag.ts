export interface Span {
    start: number;
    end: number;
    id: number;
    text: string;
}

function assertUniqueIds(spans: Span[]): void {
    const seen = new Set<number>();
    for (const span of spans) {
        if (seen.has(span.id)) {
            throw new Error(`unit-tag: duplicate span id ${span.id}`);
        }
        seen.add(span.id);
    }
}

/**
 * Wraps each span in `<xN>...</xN>` tags (escaping the rest of the text),
 * so a downstream translator that preserves inline tags can be told which
 * substrings are candidates for independent translation.
 *
 * `spans.text` is ignored - the tagged text is derived from
 * `text.slice(start, end)`.
 */
export function insertUnitTags(text: string, spans: Span[]): string {
    const sorted = spans.toSorted((a, b) => a.start - b.start);
    assertUniqueIds(sorted);

    const esc = (s: string) =>
        s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    const parts: string[] = [];
    let cursor = 0;
    for (const span of sorted) {
        if (span.start < cursor) {
            throw new Error(
                `unit-tag: overlapping span id ${span.id} starts at ${span.start}, before previous span ended at ${cursor}`,
            );
        }
        parts.push(esc(text.slice(cursor, span.start)));
        parts.push(
            `<x${span.id}>${esc(text.slice(span.start, span.end))}</x${span.id}>`,
        );
        cursor = span.end;
    }
    parts.push(esc(text.slice(cursor)));
    return parts.join("");
}

interface TagHit {
    start: number;
    end: number;
    inner: string;
}

// How far apart two fragments tagged with the same id are allowed to be
// before we refuse to merge them.
//
// ponytail: fixed character threshold, not alignment-aware. If real
// translations regularly split a unit further apart than this, swap for a
// word/token-based distance instead of a raw char count.
const MAX_MERGE_GAP = 40;

/**
 * Joins multiple occurrences of the same id into the text they jointly
 * cover, stripping only *this* id's own tags. Any other id's tag left over
 * in the result (because it fell inside the gap) is caught by the
 * "no tags left" check in `extractUnitTags`, so a foreign fragment is never
 * silently swallowed into this id's text.
 */
function mergeFragments(text: string, hits: TagHit[], id: number): string {
    const first = hits[0];
    const last = hits[hits.length - 1];
    const gap = last.start - first.end;
    if (gap > MAX_MERGE_GAP) {
        throw new Error(
            `unit-tag: id ${id} appears ${hits.length} times with too large a gap (${gap} chars) to safely merge`,
        );
    }

    const ownTag = new RegExp(`<\\/?x${id}>`, "g");
    return text.slice(first.start, last.end).replace(ownTag, "");
}

/**
 * Reads back the text found between each id's `<xN>...</xN>` tags in
 * (translated) `text`.
 *
 * Returns spans with `start`/`end` unchanged (still offsets into the
 * *original* source text) and `text` replaced with whatever was found. A
 * span whose id isn't found in `text` is returned unchanged.
 */
export function extractUnitTags(text: string, spans: Span[]): Span[] {
    const unesc = (s: string) =>
        s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    assertUniqueIds(spans);

    const idPattern = spans.map((s) => s.id).join("|");
    if (!idPattern) return [];
    const regex = new RegExp(`<x(${idPattern})>([\\s\\S]*?)<\\/x\\1>`, "g");

    const hitsById = new Map<number, TagHit[]>();
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text))) {
        const id = Number(m[1]);
        const list = hitsById.get(id) ?? [];
        list.push({ start: m.index, end: m.index + m[0].length, inner: m[2] });
        hitsById.set(id, list);
    }

    const found = new Map<number, string>();
    for (const [id, hits] of hitsById) {
        hits.sort((a, b) => a.start - b.start);

        const merged = hits.length === 1
            ? hits[0].inner
            : mergeFragments(text, hits, id);

        // Any leftover tag here belongs to some other id that fell
        // inside this id's span/gap - never silently fold it in.
        if (/<\/?x\d+>/.test(merged)) {
            throw new Error(
                `unit-tag: id ${id}'s extracted text still contains a tag, ` +
                    `likely from an interleaved/foreign id - refusing to return corrupted text`,
            );
        }

        found.set(id, unesc(merged));
    }

    return spans.map((span) => {
        const text = found.get(span.id);
        if (text === undefined) return span;
        return { ...span, text };
    });
}
