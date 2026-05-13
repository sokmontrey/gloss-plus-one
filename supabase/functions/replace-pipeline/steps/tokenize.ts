import { normalizeLexemeKey } from "../lib/lexeme.ts"
import type { BlockConfidenceState, PipelineContext, WordSpan } from "../types.ts"

/** Whitespace tokenizer + offsets into `sourceText`; swap when language-aware splitter ready. */
export async function tokenizeBlock(
  state: BlockConfidenceState,
  _ctx: PipelineContext,
): Promise<BlockConfidenceState> {
  await Promise.resolve()
  const text = state.sourceText
  const tokens: WordSpan[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    tokens.push({ raw: m[0], start: m.index, end: m.index + m[0].length })
  }
  const lookupKeys = tokens.map((t) => normalizeLexemeKey(t.raw))
  const n = tokens.length
  return {
    ...state,
    tokens,
    lookupKeys,
    perWordTranslation: Array(n).fill(""),
    contextRecoverability: Array(n).fill(0),
    userConfidentScore: Array(n).fill(0),
    presetConfidentScore: Array(n).fill(0),
    firstPassConfident: Array(n).fill(0),
    secondPassConfident: Array(n).fill(0),
    combinedConfident: Array(n).fill(0),
    replaceable: Array(n).fill(false),
    userHadLexiconRow: Array(n).fill(false),
  }
}
