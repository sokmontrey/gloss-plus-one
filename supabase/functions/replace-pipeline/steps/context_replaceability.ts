import { contextStubMultiplier } from "../lib/env_tune.ts"
import type { BlockConfidenceState, PipelineContext } from "../types.ts"

/** Stub scorer until MLM / DOM hints shipped. */
export async function contextReplaceabilityScores(
  state: BlockConfidenceState,
  _ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  await Promise.resolve()
  const stub = contextStubMultiplier()
  const n = state.tokens.length
  return {
    ...state,
    contextReplaceability: Array(n).fill(stub),
  }
}
