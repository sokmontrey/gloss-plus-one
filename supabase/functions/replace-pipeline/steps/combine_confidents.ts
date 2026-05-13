import type { BlockConfidenceState, PipelineContext } from "../types.ts"

/** Final score = lexiconMerged×translation × replaceability (stub or future MLM scorer). */
export async function combineConfidentScores(
  state: BlockConfidenceState,
  _ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  await Promise.resolve()
  const combinedConfident = state.tokens.map((_, i) => {
    const stepped = Math.min(Math.max(state.secondPassConfident[i], 0), 1)
    const repl = Math.min(Math.max(state.contextReplaceability[i], 0), 1)
    return Math.min(Math.max(stepped * repl, 0), 1)
  })

  return { ...state, combinedConfident }
}
