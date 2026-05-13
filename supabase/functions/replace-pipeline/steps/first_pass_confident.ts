import type { BlockConfidenceState, PipelineContext } from "../types.ts"

/** Merged lexicon layer: DB user row wins over preset progression when present (same field family 0–1). */
export async function firstPassConfidentScores(
  state: BlockConfidenceState,
  _ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  await Promise.resolve()
  const firstPassConfident = state.tokens.map((_, i) => {
    const preset = Math.min(Math.max(state.presetConfidentScore[i], 0), 1)
    const user = Math.min(Math.max(state.userConfidentScore[i], 0), 1)
    const base = state.userHadLexiconRow[i] ? user : preset
    return base
  })

  return { ...state, firstPassConfident }
}
