import { highlightLevelFromCombined } from "../lib/env_tune.ts"
import { mimicCaseReplacement } from "../lib/lexeme.ts"
import type { BlockConfidenceState, InlineEdit, PipelineContext } from "../types.ts"

export async function buildEditsFromConfidents(
  state: BlockConfidenceState,
  ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  await Promise.resolve()
  const edits: InlineEdit[] = []

  for (let i = 0; i < state.tokens.length; i++) {
    if (!state.replaceable[i]) continue

    const span = state.tokens[i]
    const original = state.sourceText.slice(span.start, span.end)
    const baseRep = state.perWordTranslation[i]?.length ? state.perWordTranslation[i] : original
    const replacement = mimicCaseReplacement(baseRep, original)
    const score = state.combinedConfident[i]

    edits.push({
      id: `${ctx.requestId}-${state.blockId}-lex-${i}`,
      start: span.start,
      end: span.end,
      original,
      replacement,
      highlight: { level: highlightLevelFromCombined(score) },
      data: {
        combinedConfident: score,
        userConfident: state.userConfidentScore[i],
        presetConfident: state.presetConfidentScore[i],
      },
    })
  }

  return { ...state, edits }
}
