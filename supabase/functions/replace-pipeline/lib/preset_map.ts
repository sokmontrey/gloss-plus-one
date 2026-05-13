import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeLexemeKey } from "./lexeme.ts"

/** Max `initial_progression_score` per (lookupKey, preset_type overlap). */
export type PresetSlices = Map<string, { contentMax: number; functionalMax: number }>

type PresetRow = {
  value: string
  preset_type: string
  initial_progression_score: number
}

export async function loadPresetSlicesForLanguage(
  supabase: SupabaseClient,
  languageCode: string,
): Promise<PresetSlices> {
  const slices: PresetSlices = new Map()
  const PAGE = 900
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from("preset_lexicons")
      .select("value, preset_type, initial_progression_score")
      .eq("language_code", languageCode)
      .order("value", { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) throw new Error(error.message ?? "preset_lexicons query failed")

    const rows = (data ?? []) as PresetRow[]
    for (const row of rows) {
      const lookupKey = normalizeLexemeKey(row.value)
      if (!lookupKey) continue

      let slot = slices.get(lookupKey)
      if (!slot) {
        slot = { contentMax: 0, functionalMax: 0 }
        slices.set(lookupKey, slot)
      }

      if (row.preset_type === "content") {
        slot.contentMax = Math.max(slot.contentMax, row.initial_progression_score)
      } else if (row.preset_type === "functional") {
        slot.functionalMax = Math.max(slot.functionalMax, row.initial_progression_score)
      }
    }

    if (rows.length < PAGE) break
    from += PAGE
  }

  return slices
}

/** Weight preset_type branches; avg when both buckets populated, else whichever > 0. */
export function weightedPresetProgression(slice: PresetSlices, lookupKey: string): number {
  const slot = slice.get(lookupKey)
  if (!slot) return 0

  const c = Number(slot.contentMax)
  const f = Number(slot.functionalMax)

  const cw = Number(Deno.env.get("PRESET_WEIGHT_CONTENT"))
  const fw = Number(Deno.env.get("PRESET_WEIGHT_FUNCTIONAL"))
  const cwOk = Number.isFinite(cw) && cw >= 0
  const fwOk = Number.isFinite(fw) && fw >= 0
  const cwN = cwOk ? cw : 0.65
  const fwN = fwOk ? fw : 0.35
  const denom = cwN + fwN || 1

  let score = 0
  if (c > 1e-9 && f > 1e-9) score = (c * cwN + f * fwN) / denom
  else score = Math.max(c, f)

  return Math.min(Math.max(score, 0), 1)
}
