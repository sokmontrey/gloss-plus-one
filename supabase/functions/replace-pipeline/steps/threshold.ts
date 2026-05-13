import type { BlockConfidenceState, PipelineContext } from "../types.ts"

export async function thresholdReplaceable(
  state: BlockConfidenceState,
  ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  const tau = ctx.resolvedReplaceThreshold
  const replaceable = state.tokens.map((_, i) => state.combinedConfident[i] >= tau)

  return { ...state, replaceable }
}
