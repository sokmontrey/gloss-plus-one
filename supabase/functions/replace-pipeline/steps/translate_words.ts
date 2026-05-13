import type { BlockConfidenceState, PipelineContext } from "../types.ts"

/** MVP identity translation (highlight path); swap when MT wired. */
export async function translateWords(
  state: BlockConfidenceState,
  _ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  await Promise.resolve()
  const pw = state.tokens.map((t) => t.raw)
  return { ...state, perWordTranslation: pw }
}
