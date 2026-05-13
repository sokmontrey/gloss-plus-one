import { chunkArray } from "../lib/chunk.ts"
import type { BlockConfidenceState, PipelineContext } from "../types.ts"

/** After threshold: insert missing `user_lexicon_confidents` rows with capped `combinedConfident`. */
export async function persistNewLexiconConfidents(
  state: BlockConfidenceState,
  ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  const aggregated = new Map<string, number>()

  for (let i = 0; i < state.tokens.length; i++) {
    if (!state.replaceable[i]) continue

    const lk = state.lookupKeys[i]
    if (!lk.length) continue

    const alreadyKnown =
      state.userHadLexiconRow[i] || ctx.persistedLexiconKeysThisInvoke.has(lk)
    if (alreadyKnown) continue

    const c = Math.min(Math.max(state.combinedConfident[i], 0), 1)
    aggregated.set(lk, Math.max(aggregated.get(lk) ?? 0, c))
  }

  const newcomerKeys = [...aggregated.keys()]
  if (newcomerKeys.length === 0) return state

  const confirmedMissing: string[] = []

  try {
    for (const slice of chunkArray(newcomerKeys, 120)) {
      const { data, error } = await ctx.supabase
        .from("user_lexicon_confidents")
        .select("value")
        .eq("language_code", ctx.targetLanguage)
        .in("value", slice)

      if (error) throw new Error(error.message ?? "user_lexicon_confidents prefetch insert guard failed")

      const present = new Set((data ?? []).map((row: { value: string }) => row.value))

      for (const k of slice) {
        if (!present.has(k)) confirmedMissing.push(k)
      }
    }

    const inserts = confirmedMissing.map((value) => ({
      user_id: ctx.userId,
      language_code: ctx.targetLanguage,
      value,
      confident_score: aggregated.get(value)!,
    }))

    if (inserts.length === 0) return state

    for (const batch of chunkArray(inserts, 80)) {
      const { error: insErr } = await ctx.supabase.from("user_lexicon_confidents").insert(batch)
      if (insErr) throw new Error(insErr.message ?? "user_lexicon_confidents insert failed")
      for (const row of batch) {
        ctx.persistedLexiconKeysThisInvoke.add(row.value)
      }
    }
  } catch (e) {
    console.warn("[replace-pipeline] persistNewLexiconConfidents failed:", e)
  }

  return state
}
