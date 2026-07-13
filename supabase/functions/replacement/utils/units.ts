import type { RecoverabilityToken } from "../recoverability/index.ts";
import type { Span } from "./unit-tag.ts";

export interface UnitScore extends Span {
    score: number;
}

/**
 * Splits `text` into whitespace-delimited units (words) with their start/end
 * offsets in the original text, and computes the average score of every
 * recoverability token whose span overlaps a given unit's span.
 *
 * Tokens are sorted by their start offset and units are produced in
 * left-to-right order too, so scores can be assigned with a single
 * two-pointer sweep instead of comparing every token against every unit.
 * This keeps accumulation O(units + tokens) - correct and efficient even
 * when the same word occurs many times in the text, since each occurrence
 * is a distinct span and is scored purely from its position, with no
 * per-word text matching involved.
 */
export function accumulateUnitScores(
    text: string,
    tokens: RecoverabilityToken[],
): UnitScore[] {
    const sortedTokens = tokens.toSorted((a, b) => a.start - b.start);

    const units: UnitScore[] = [];
    const wordPattern = /\S+/g;
    let match: RegExpExecArray | null;
    let id = 0;
    let tokenCursor = 0;

    while ((match = wordPattern.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        // Tokens ending at or before this unit's start can never overlap
        // this or any later unit (both lists are sorted by start), so
        // permanently skip past them.
        while (
            tokenCursor < sortedTokens.length &&
            sortedTokens[tokenCursor].end <= start
        ) {
            tokenCursor++;
        }

        let scoreSum = 0;
        let tokenCount = 0;
        for (
            let i = tokenCursor;
            i < sortedTokens.length && sortedTokens[i].start < end;
            i++
        ) {
            scoreSum += sortedTokens[i].score;
            tokenCount++;
        }

        const score = tokenCount > 0 ? scoreSum / tokenCount : 0;

        units.push({ id: id++, start, end, text: match[0], score });
    }

    return units;
}

export interface ReplaceableSegment extends Span {
    score: number;
}

/**
 * Merges adjacent replaceable units into contiguous segments.
 *
 * Units are considered adjacent - and therefore merged into the same
 * segment - when, once sorted by `start`, the gap between them (the next
 * unit's `start` minus the current one's `end`) is at most 1. That allows
 * a single separating character (typically a space) between two units
 * while still treating them as part of the same replaceable segment.
 *
 * A segment's `score` is the average of the scores of the units merged
 * into it, and its `text`/`end` span the full range of the original text
 * it covers (including any in-between separator characters).
 */
export function mergeAdjacentUnits(
    text: string,
    units: UnitScore[],
): ReplaceableSegment[] {
    const sorted = units.toSorted((a, b) => a.start - b.start);

    interface Building {
        start: number;
        end: number;
        scoreSum: number;
        count: number;
    }

    const merged: Building[] = [];

    for (const unit of sorted) {
        const last = merged[merged.length - 1];
        if (last && unit.start - last.end <= 1) {
            last.end = unit.end;
            last.scoreSum += unit.score;
            last.count += 1;
        } else {
            merged.push({
                start: unit.start,
                end: unit.end,
                scoreSum: unit.score,
                count: 1,
            });
        }
    }

    return merged.map((segment, id) => ({
        id,
        start: segment.start,
        end: segment.end,
        text: text.slice(segment.start, segment.end),
        score: segment.scoreSum / segment.count,
    }));
}
