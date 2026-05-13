import { weightedPresetProgression } from "../lib/preset_map.ts"
import type { BlockConfidenceState, PipelineContext } from "../types.ts"

export async function presetLexiconConfidentLookup(
  state: BlockConfidenceState,
  ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  await Promise.resolve()
  const presetConfidentScore = state.lookupKeys.map((lk) =>
    lk.length ? weightedPresetProgression(ctx.presetSlices, lk) : 0,
  )

  return { ...state, presetConfidentScore }
}
