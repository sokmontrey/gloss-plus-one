import type { BlockConfidenceState, PipelineContext } from "../types.ts"

/** Final score = lexiconMerged×translation × recoverability (stub or MLM lane). */
export async function combineConfidentScores(
  state: BlockConfidenceState,
  _ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  await Promise.resolve()
  const combinedConfident = state.tokens.map((_, i) => {
    const stepped = Math.min(Math.max(state.secondPassConfident[i], 0), 1)
    const rec = Math.min(Math.max(state.contextRecoverability[i], 0), 1)
    return Math.min(Math.max(stepped * rec, 0), 1)
  })

  return { ...state, combinedConfident }
}
