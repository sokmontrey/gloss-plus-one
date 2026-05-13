import { thresholdForLanguage } from "../lib/env_tune.ts"
import type { BlockConfidenceState, PipelineContext } from "../types.ts"

export async function thresholdReplaceable(
  state: BlockConfidenceState,
  ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  await Promise.resolve()
  const tau = thresholdForLanguage(ctx.targetLanguage)
  const replaceable = state.tokens.map((_, i) => state.combinedConfident[i] >= tau)

  return { ...state, replaceable }
}
