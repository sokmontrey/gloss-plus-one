import type { BlockConfidenceState, PipelineBlockIn } from "../types.ts"

export function initBlockState(block: PipelineBlockIn): BlockConfidenceState {
  return {
    blockId: block.blockId,
    sourceText: block.text,
    normalizedText: block.text,
    tokens: [],
    lookupKeys: [],
    perWordTranslation: [],
    contextReplaceability: [],
    userConfidentScore: [],
    presetConfidentScore: [],
    firstPassConfident: [],
    secondPassConfident: [],
    combinedConfident: [],
    replaceable: [],
    userHadLexiconRow: [],
    edits: [],
  }
}
