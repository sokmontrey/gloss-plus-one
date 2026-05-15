import type { ExtractionBatch, ExtractionResult, PipelineResponse, TextBlock, InlineEdit } from '@/extraction'
import { getSupabase } from '@/lib/supabase'

const EXTRACTION_RESULT_MESSAGE = 'gloss-plus-one:extraction-result'
const EXTRACTION_BATCH_MESSAGE = 'gloss-plus-one:extraction-batch'
const PIPELINE_RESPONSE_MESSAGE = 'gloss-plus-one:pipeline-response'

console.info('[gloss+1] service worker started')

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return undefined

  if (message.type === EXTRACTION_BATCH_MESSAGE) {
    handleExtractionBatch(message, sender)
    sendResponse({ ok: true })
    return false
  }

  if (message.type === EXTRACTION_RESULT_MESSAGE) {
    handleExtractionResult(message.reason, message.result, sender)
    sendResponse({ ok: true })
    return false
  }

  return undefined
})

// ── Batch handler ──────────────────────────────────────────────────────────────

function handleExtractionBatch(
  message: { reason: string; batch: ExtractionBatch; url: string },
  sender: chrome.runtime.MessageSender,
): void {
  const { batch } = message

  console.info('[gloss+1] extraction batch received:', {
    url: message.url,
    reason: message.reason,
    blockCount: batch.blocks.length,
  })

  if (batch.blocks.length === 0) return

  void processBlocks(batch.blocks, sender.tab?.id)
}

function handleExtractionResult(
  reason: string,
  result: ExtractionResult,
  sender: chrome.runtime.MessageSender,
): void {
  console.info('[gloss+1] extraction result received:', {
    url: result.url,
    reason,
    blockCount: result.blocks.length,
  })

  if (result.blocks.length === 0) return

  void processBlocks(result.blocks, sender.tab?.id)
}

// ── Pipeline orchestration ─────────────────────────────────────────────────────

async function processBlocks(blocks: TextBlock[], tabId: number | undefined): Promise<void> {
  if (!tabId) {
    console.warn('[gloss+1] no tab id, cannot send pipeline response')
    return
  }

  const supabase = getSupabase()
  if (!supabase) {
    console.warn('[gloss+1] supabase client not configured, skipping pipeline')
    return
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.info('[gloss+1] no auth session, skipping pipeline')
    return
  }

  const accessToken = session.access_token

  // Load user's target language (default: fr)
  const targetLanguage = await getUserTargetLanguage(supabase, session.user.id)

  // Process blocks concurrently (capped to avoid overwhelming the edge function)
  const MAX_CONCURRENT = 3
  const responseBlocks: PipelineResponse['blocks'] = []

  for (let i = 0; i < blocks.length; i += MAX_CONCURRENT) {
    const chunk = blocks.slice(i, i + MAX_CONCURRENT)
    const results = await Promise.allSettled(
      chunk.map((block) => callReplacementEdgeFunction(block, targetLanguage, accessToken)),
    )

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        responseBlocks.push(result.value)
      } else if (result.status === 'rejected') {
        console.warn('[gloss+1] pipeline call failed:', result.reason)
      }
    }
  }

  if (responseBlocks.length === 0) return

  const response: PipelineResponse = {
    schemaVersion: 1,
    requestId: `batch-${Date.now()}`,
    blocks: responseBlocks,
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: PIPELINE_RESPONSE_MESSAGE,
      response,
    })
  } catch (error) {
    console.warn('[gloss+1] failed to send pipeline response to tab:', error)
  }
}

// ── Edge function call ─────────────────────────────────────────────────────────

interface EdgeFunctionResponse {
  id: string
  replacements: Array<{
    start: number
    end: number
    original: string
    replacement: string
    score?: number
  }>
}

async function callReplacementEdgeFunction(
  block: TextBlock,
  targetLanguage: string,
  accessToken: string,
): Promise<PipelineResponse['blocks'][0] | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  if (!supabaseUrl) return null

  const url = `${supabaseUrl}/functions/v1/replacement`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      id: block.blockId,
      text: block.text,
      originalLanguage: 'en',
      targetLanguage,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn(`[gloss+1] edge function ${res.status}:`, text)
    return null
  }

  const data: EdgeFunctionResponse = await res.json()

  if (!data.replacements || data.replacements.length === 0) return null

  const edits: InlineEdit[] = data.replacements.map((rep, i) => ({
    id: `${block.blockId}-${i}`,
    start: rep.start,
    end: rep.end,
    original: rep.original,
    replacement: rep.replacement,
    data: { score: rep.score ?? 0.5 },
  }))

  return {
    blockId: block.blockId,
    edits,
  }
}

// ── User profile helper ────────────────────────────────────────────────────────

const DEFAULT_TARGET_LANGUAGE = 'fr'

async function getUserTargetLanguage(
  supabase: ReturnType<typeof getSupabase>,
  userId: string,
): Promise<string> {
  if (!supabase) return DEFAULT_TARGET_LANGUAGE

  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('target_language')
      .eq('user_id', userId)
      .maybeSingle()

    return data?.target_language ?? DEFAULT_TARGET_LANGUAGE
  } catch {
    return DEFAULT_TARGET_LANGUAGE
  }
}
