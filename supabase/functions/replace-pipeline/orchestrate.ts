import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchUserTargetLanguage } from "./lib/profile_lang.ts"
import {
  loadPresetSlicesForLanguage,
  type PresetSlices,
} from "./lib/preset_map.ts"
import { initBlockState } from "./steps/init_state.ts"
import { preprocessBlock } from "./steps/preprocess.ts"
import { tokenizeBlock } from "./steps/tokenize.ts"
import { translateWords } from "./steps/translate_words.ts"
import { contextReplaceabilityScores } from "./steps/context_replaceability.ts"
import { userConfidentLookup } from "./steps/user_confident_lookup.ts"
import { presetLexiconConfidentLookup } from "./steps/preset_lexicon_confident_lookup.ts"
import { firstPassConfidentScores } from "./steps/first_pass_confident.ts"
import { secondPassConfidentScores } from "./steps/second_pass_confident.ts"
import { combineConfidentScores } from "./steps/combine_confidents.ts"
import { thresholdReplaceable } from "./steps/threshold.ts"
import { buildEditsFromConfidents } from "./steps/build_edits.ts"
import { persistNewLexiconConfidents } from "./steps/persist_new_lexicon_confidents.ts"
import type { PipelineContext, PipelineRequestV1, PipelineResponseV1 } from "./types.ts"

export async function runModularPipeline(
  supabase: SupabaseClient,
  userId: string,
  request: PipelineRequestV1,
): Promise<PipelineResponseV1> {
  const requestId = `pipeline-v1-${Date.now()}-${crypto.randomUUID()}`
  const targetLanguage = await fetchUserTargetLanguage(supabase, userId)

  let presetSlices: PresetSlices = new Map()
  try {
    presetSlices = await loadPresetSlicesForLanguage(supabase, targetLanguage)
  } catch (e) {
    console.warn("[replace-pipeline] preset_lexicons prefetch failed:", e)
  }

  const ctxShared: Omit<PipelineContext, "requestId"> = {
    userId,
    supabase,
    targetLanguage,
    presetSlices,
    persistedLexiconKeysThisInvoke: new Set<string>(),
    url: request.url,
    reason: request.reason,
  }

  const outputBlocks: PipelineResponseV1["blocks"] = []

  for (const b of request.blocks) {
    const ctx: PipelineContext = {
      ...ctxShared,
      requestId,
    }

    let s = initBlockState(b)
    s = await preprocessBlock(s, ctx)
    s = await tokenizeBlock(s, ctx)
    s = await translateWords(s, ctx)
    s = await contextReplaceabilityScores(s, ctx)
    s = await userConfidentLookup(s, ctx)
    s = await presetLexiconConfidentLookup(s, ctx)
    s = await firstPassConfidentScores(s, ctx)
    s = await secondPassConfidentScores(s, ctx)
    s = await combineConfidentScores(s, ctx)
    s = await thresholdReplaceable(s, ctx)
    s = await buildEditsFromConfidents(s, ctx)
    s = await persistNewLexiconConfidents(s, ctx)

    if (s.edits.length > 0) outputBlocks.push({ blockId: s.blockId, edits: s.edits })
  }

  return {
    schemaVersion: 1,
    requestId,
    blocks: outputBlocks,
    data: {
      source: "replace-pipeline-modular-v1",
      targetLanguage,
      presetRowKeys: presetSlices.size,
    },
  }
}
