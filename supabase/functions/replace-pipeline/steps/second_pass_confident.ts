import { translationMvpFactor } from "../lib/env_tune.ts"
import type { BlockConfidenceState, PipelineContext } from "../types.ts"

/** Translation channel multiplies merged lexicon (MVP scalar from env). */
export async function secondPassConfidentScores(
  state: BlockConfidenceState,
  _ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  await Promise.resolve()
  const T = translationMvpFactor()

  const secondPassConfident = state.tokens.map((_, i) => {
    const lex = Math.min(Math.max(state.firstPassConfident[i], 0), 1)
    return Math.min(Math.max(lex * T, 0), 1)
  })

  return { ...state, secondPassConfident }
}
