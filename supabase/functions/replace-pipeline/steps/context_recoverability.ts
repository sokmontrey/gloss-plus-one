import {
  contextStubMultiplier,
  recoverabilityApiBaseUrl,
  recoverabilityApiDisabledFlag,
  recoverabilityRequestFormat,
  recoverabilityRequestTimeoutMs,
  recoverabilityScoreConfigFromEnv,
  recoverabilityScorePath,
} from "../lib/env_tune.ts"
import { fetchRecoverabilityLanes } from "../lib/recoverability_api.ts"
import type { BlockConfidenceState, PipelineContext } from "../types.ts"

/** MLM recoverability lane when `RECOVERABILITY_API_URL` set; else `PIPELINE_CONTEXT_STUB`. */
export async function contextRecoverabilityScores(
  state: BlockConfidenceState,
  _ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  const stub = contextStubMultiplier()
  const n = state.tokens.length

  if (n === 0) {
    return { ...state, contextRecoverability: [] }
  }

  const base = recoverabilityApiBaseUrl()
  const path = recoverabilityScorePath()
  const format = recoverabilityRequestFormat()

  if (!base || recoverabilityApiDisabledFlag()) {
    console.info("[replace-pipeline] recoverability stub:", {
      reason: !base ? "RECOVERABILITY_API_URL unset" : "RECOVERABILITY_DISABLED",
      stubMultiplier: stub,
      tokens: n,
    })
    return { ...state, contextRecoverability: Array(n).fill(stub) }
  }

  const lanes = await fetchRecoverabilityLanes(
    base,
    path,
    state,
    format,
    recoverabilityRequestTimeoutMs(),
    recoverabilityScoreConfigFromEnv(),
  )

  if (!lanes || lanes.length !== n) {
    console.info(
      "[replace-pipeline] recoverability stub: MLM fetch failed, empty scores, or length mismatch (see prior warn)",
      { format, path },
    )
    return { ...state, contextRecoverability: Array(n).fill(stub) }
  }

  console.info("[replace-pipeline] recoverability MLM ok", {
    base,
    path,
    format,
    tokens: n,
  })

  const contextRecoverability = lanes.map((v) => Math.min(Math.max(v * stub, 0), 1))

  return { ...state, contextRecoverability }
}
