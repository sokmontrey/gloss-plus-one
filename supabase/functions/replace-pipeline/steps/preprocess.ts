import type { BlockConfidenceState, PipelineContext } from "../types.ts"

export async function preprocessBlock(
  state: BlockConfidenceState,
  _ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  await Promise.resolve()
  return { ...state, normalizedText: state.sourceText }
}
