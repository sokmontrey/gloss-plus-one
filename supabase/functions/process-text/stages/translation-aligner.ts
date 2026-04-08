import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { Token } from '../types.ts'

// Stage 3: Translation Alignment
// Two-query approach to avoid PostgREST self-join issues.
// PostgREST supports embedded resources via FK hints, but a self-referential
// join (lemmas → translation_mappings → lemmas) requires the FK constraint
// name to match exactly, which is fragile and fails silently.
//
// Query 1: fetch source lemmas + their translation_mapping target IDs
// Query 2: fetch target lemma text for all collected target IDs

interface SourceRow {
  id: string
  lemma: string
  pos: string
  category: string
  translation_mappings: Array<{ target_lemma_id: string }>
}

interface TargetRow {
  id: string
  lemma: string
}

export class DbTranslationAligner {
  constructor(private readonly supabase: SupabaseClient) {}

  async align(
    tokens: Token[],
    sourceLangId: string,
    _targetLangId: string, // reserved: filter mappings by target language when multiple targets per source lemma are supported
  ): Promise<Token[]> {
    const wordTokens = tokens.filter((t) => t.is_word)
    if (wordTokens.length === 0) return tokens

    const uniqueLemmas = [...new Set(wordTokens.map((t) => t.lemma))]

    // Query 1: source lemmas + translation mapping IDs only (no self-join)
    const { data: sourceData, error: sourceError } = await this.supabase
      .from('lemmas')
      .select('id, lemma, pos, category, translation_mappings(target_lemma_id)')
      .eq('language_id', sourceLangId)
      .in('lemma', uniqueLemmas)

    if (sourceError) {
      console.error('[process-text] translation-aligner source query error:', sourceError.message)
      return tokens
    }

    const sourceRows = (sourceData ?? []) as SourceRow[]

    // Collect all unique target lemma IDs
    const targetIds = [
      ...new Set(
        sourceRows.flatMap((r) => r.translation_mappings.map((m) => m.target_lemma_id)),
      ),
    ]

    // Query 2: target lemma text
    const targetById = new Map<string, string>()
    if (targetIds.length > 0) {
      const { data: targetData, error: targetError } = await this.supabase
        .from('lemmas')
        .select('id, lemma')
        .in('id', targetIds)

      if (targetError) {
        console.error('[process-text] translation-aligner target query error:', targetError.message)
      } else {
        for (const row of (targetData ?? []) as TargetRow[]) {
          targetById.set(row.id, row.lemma)
        }
      }
    }

    // Index source rows by lemma text for O(1) lookup
    const byLemma = new Map<string, SourceRow>()
    for (const row of sourceRows) {
      byLemma.set(row.lemma, row)
    }

    return tokens.map((token) => {
      if (!token.is_word) return token

      const row = byLemma.get(token.lemma)
      if (!row) return token

      const mapping = row.translation_mappings[0] ?? null
      const targetLemmaId = mapping?.target_lemma_id ?? null

      return {
        ...token,
        source_lemma_id: row.id,
        category: row.category,
        target_lemma_id: targetLemmaId,
        target_lemma: targetLemmaId ? (targetById.get(targetLemmaId) ?? null) : null,
      }
    })
  }
}
