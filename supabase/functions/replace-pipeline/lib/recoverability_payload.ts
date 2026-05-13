import type { BlockConfidenceState } from "../types.ts"
import type { RecoverabilityScoreRequestV1 } from "./recoverability_contract.ts"

export function buildRecoverabilityScoreRequestV1(state: BlockConfidenceState): RecoverabilityScoreRequestV1 {
  return {
    schema_version: 1,
    text: state.sourceText,
    spans: state.tokens.map((t) => ({ start: t.start, end: t.end })),
    token_surfaces: state.tokens.map((t) => t.raw),
  }
}
