import { chunkArray } from "../lib/chunk.ts"
import { normalizeLexemeKey } from "../lib/lexeme.ts"
import type { BlockConfidenceState, PipelineContext } from "../types.ts"

type Row = { value: string; confident_score: number }

function falseHadRow(length: number): boolean[] {
  return Array(length).fill(false)
}

/** Batch-fetch `user_lexicon_confidents` for token lookup keys at target_language. */
export async function userConfidentLookup(
  state: BlockConfidenceState,
  ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  const uniq = [...new Set(state.lookupKeys.filter((k) => k.length > 0))]
  if (uniq.length === 0) {
    return { ...state, userHadLexiconRow: falseHadRow(state.lookupKeys.length) }
  }

  const scoreByNormalized = new Map<string, number>()
  const CHUNK = 80

  try {
    for (const slice of chunkArray(uniq, CHUNK)) {
      const { data, error } = await ctx.supabase
        .from("user_lexicon_confidents")
        .select("value, confident_score")
        .eq("language_code", ctx.targetLanguage)
        .in("value", slice)

      if (error) throw new Error(error.message ?? "user_lexicon_confidents query failed")

      for (const row of ((data ?? []) as Row[]) ?? []) {
        const k = normalizeLexemeKey(row.value)
        scoreByNormalized.set(k, Math.max(scoreByNormalized.get(k) ?? 0, Number(row.confident_score)))
      }
    }
  } catch (e) {
    console.warn("[replace-pipeline] user_lexicon_confidents batch failed:", e)
    return { ...state, userHadLexiconRow: falseHadRow(state.lookupKeys.length) }
  }

  const userConfidentScore = state.lookupKeys.map((lk) =>
    lk ? Math.min(Math.max(scoreByNormalized.get(lk) ?? 0, 0), 1) : 0,
  )

  const userHadLexiconRow = state.lookupKeys.map((lk) => lk.length > 0 && scoreByNormalized.has(lk))

  return { ...state, userConfidentScore, userHadLexiconRow }
}
