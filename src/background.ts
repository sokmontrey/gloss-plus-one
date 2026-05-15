import type { ExtractionBatch, ExtractionResult, PipelineResponse, TextBlock, InlineEdit } from '@/extraction'
import { getSupabase } from '@/lib/supabase'

const EXTRACTION_RESULT_MESSAGE = 'gloss-plus-one:extraction-result'
const EXTRACTION_BATCH_MESSAGE = 'gloss-plus-one:extraction-batch'
const PIPELINE_RESPONSE_MESSAGE = 'gloss-plus-one:pipeline-response'
const CANCEL_PIPELINE_MESSAGE = 'gloss-plus-one:cancel-pipeline'

// Per-tab sets of AbortControllers — one per in-flight batch.
// Navigation cancels all of them; new same-page batches do NOT abort existing ones.
const tabControllers = new Map<number, Set<AbortController>>()

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

  if (message.type === CANCEL_PIPELINE_MESSAGE) {
    const tabId = sender.tab?.id
    if (tabId !== undefined) {
      tabControllers.get(tabId)?.forEach((c) => c.abort())
      tabControllers.delete(tabId)
    }
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
  const tabId = sender.tab?.id

  console.info('[gloss+1] extraction batch received:', {
    url: message.url,
    reason: message.reason,
    blockCount: batch.blocks.length,
  })

  if (batch.blocks.length === 0) return

  const controller = new AbortController()
  if (tabId !== undefined) {
    if (!tabControllers.has(tabId)) tabControllers.set(tabId, new Set())
    tabControllers.get(tabId)!.add(controller)
  }

  void processBlocks(batch.blocks, tabId, controller)
}

function handleExtractionResult(
  reason: string,
  result: ExtractionResult,
  sender: chrome.runtime.MessageSender,
): void {
  const tabId = sender.tab?.id

  console.info('[gloss+1] extraction result received:', {
    url: result.url,
    reason,
    blockCount: result.blocks.length,
  })

  if (result.blocks.length === 0) return

  const controller = new AbortController()
  if (tabId !== undefined) {
    if (!tabControllers.has(tabId)) tabControllers.set(tabId, new Set())
    tabControllers.get(tabId)!.add(controller)
  }

  void processBlocks(result.blocks, tabId, controller)
}

// ── Pipeline orchestration ─────────────────────────────────────────────────────

async function processBlocks(
  blocks: TextBlock[],
  tabId: number | undefined,
  controller: AbortController,
): Promise<void> {
  const { signal } = controller
  const inputBlockCount = blocks.length
  if (!tabId) {
    console.warn('[gloss+1] no tab id, cannot send pipeline response')
    return
  }

  if (signal.aborted) return

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
    if (signal.aborted) {
      console.info('[gloss+1] pipeline cancelled for tab', tabId)
      return
    }

    const chunk = blocks.slice(i, i + MAX_CONCURRENT)
    const results = await Promise.allSettled(
      chunk.map((block) => callReplacementEdgeFunction(block, targetLanguage, accessToken, signal)),
    )

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        responseBlocks.push(result.value)
      } else if (result.status === 'rejected') {
        if ((result.reason as { name?: string })?.name !== 'AbortError') {
          console.warn('[gloss+1] pipeline call failed:', result.reason)
        }
      }
    }
  }

  if (signal.aborted) return

  // Remove this controller from the tab's set now that it's done
  tabControllers.get(tabId)?.delete(controller)

  // Always send response (even if empty) so content script can decrement its pending counter
  const response: PipelineResponse = {
    schemaVersion: 1,
    requestId: `batch-${Date.now()}`,
    blocks: responseBlocks,
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: PIPELINE_RESPONSE_MESSAGE,
      response,
      inputBlockCount,
    })
  } catch (error) {
    console.warn('[gloss+1] failed to send pipeline response to tab:', error)
  }
}

// ── Block result cache ────────────────────────────────────────────────────────

const CACHE_PREFIX = 'gloss:v1:'

interface CachedBlock {
  edits: Array<{ start: number; end: number; original: string; replacement: string; score: number }>
}

function djb2(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = (((h << 5) + h) ^ text.charCodeAt(i)) >>> 0
  }
  return h.toString(36)
}

function blockCacheKey(text: string, lang: string): string {
  return `${CACHE_PREFIX}${lang}:${djb2(text)}`
}

async function getBlockCache(text: string, lang: string): Promise<CachedBlock | undefined> {
  const key = blockCacheKey(text, lang)
  const result = await chrome.storage.local.get(key)
  return result[key] as CachedBlock | undefined
}

async function setBlockCache(text: string, lang: string, cached: CachedBlock): Promise<void> {
  const key = blockCacheKey(text, lang)
  await chrome.storage.local.set({ [key]: cached })
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
  signal?: AbortSignal,
): Promise<PipelineResponse['blocks'][0] | null> {
  // Cache check — skip the edge function entirely on hit
  const cached = await getBlockCache(block.text, targetLanguage)
  if (cached !== undefined) {
    console.info('[gloss+1] cache hit for block', block.blockId)
    if (cached.edits.length === 0) return null
    return {
      blockId: block.blockId,
      edits: cached.edits.map((e, i) => ({
        id: `${block.blockId}-${i}`,
        start: e.start,
        end: e.end,
        original: e.original,
        replacement: e.replacement,
        data: { score: e.score },
      })),
    }
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  if (!supabaseUrl) return null

  const url = `${supabaseUrl}/functions/v1/replacement`

  const res = await fetch(url, {
    method: 'POST',
    signal,
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

  // Cache the result (including empty — so we don't retry blocks with no replacements)
  const cacheEdits = (data.replacements ?? []).map((rep) => ({
    start: rep.start,
    end: rep.end,
    original: rep.original,
    replacement: rep.replacement,
    score: rep.score ?? 0.5,
  }))
  void setBlockCache(block.text, targetLanguage, { edits: cacheEdits })

  if (cacheEdits.length === 0) return null

  const edits: InlineEdit[] = cacheEdits.map((e, i) => ({
    id: `${block.blockId}-${i}`,
    start: e.start,
    end: e.end,
    original: e.original,
    replacement: e.replacement,
    data: { score: e.score },
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
