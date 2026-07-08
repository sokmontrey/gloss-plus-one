import type { ExtractionBatch, ExtractionResult, PipelineResponse, TextBlock, InlineEdit } from '@/extraction'
import { GOOGLE_SIGN_IN_MESSAGE, completeOAuthRedirect, requestGoogleOAuthUrl } from '@/lib/auth'
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

  if (message.type === GOOGLE_SIGN_IN_MESSAGE) {
    void handleGoogleSignIn().then(sendResponse)
    return true
  }

  return undefined
})

// ── Google sign-in ─────────────────────────────────────────────────────────────
// Run from the service worker: `launchWebAuthFlow` here opens a fresh window,
// leaving the popup alive. The popup's own JS context is destroyed by Chrome
// when OAuth replaces it, so running this from the popup loses the session
// write that `exchangeCodeForSession` does at the end of the flow.

async function handleGoogleSignIn(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Supabase client is not configured' }

  try {
    const authUrl = await requestGoogleOAuthUrl(supabase, chrome.identity.getRedirectURL())
    console.debug('[auth] OAuth URL:', authUrl)

    const responseUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true })
    if (!responseUrl) throw new Error('Sign-in was cancelled')
    console.debug('[auth] redirect URL:', responseUrl)

    await completeOAuthRedirect(supabase, responseUrl)
    return { ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Sign-in failed'
    console.warn('[gloss+1] sign-in failed:', error)
    return { ok: false, error }
  }
}

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

  if (batch.blocks.length === 0 || tabId === undefined) return

  enqueueGroup(tabId, batch.blocks)
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

  if (result.blocks.length === 0 || tabId === undefined) return

  enqueueGroup(tabId, result.blocks)
}

// ── Request batching ────────────────────────────────────────────────────────────
//
// Text blocks that are extracted close together in time (e.g. several small
// extraction batches fired in quick succession while the user scrolls) are
// coalesced into a single HTTP request to the edge function instead of each
// one triggering its own individual call. This cuts down on the number of
// concurrent translation calls made downstream, which is what actually trips
// provider-side rate limits.
//
// Coalescing is scoped per tab: the first group to arrive for a tab starts a
// debounce window; any further groups for that tab arriving before the
// window elapses are folded into the same flush. Each group still gets back
// its own PIPELINE_RESPONSE_MESSAGE (in arrival order), so the content
// script's per-batch progress/scanning bookkeeping is unaffected — only the
// network layer underneath is batched.

const BATCH_DEBOUNCE_MS = 250

// EXPERIMENTAL: every uncached block collected in a flush is sent to the
// edge function as a single HTTP request (no chunking), so the pipeline
// receives — and translates — the whole page in one shot. This exists to
// test whether that still trips the translation provider's rate limit.

interface PendingGroup {
  tabId: number
  blocks: TextBlock[]
  controller: AbortController
}

const tabBatchQueues = new Map<number, PendingGroup[]>()
const tabBatchTimers = new Map<number, ReturnType<typeof setTimeout>>()

function enqueueGroup(tabId: number, blocks: TextBlock[]): void {
  const controller = new AbortController()
  if (!tabControllers.has(tabId)) tabControllers.set(tabId, new Set())
  tabControllers.get(tabId)!.add(controller)

  const queue = tabBatchQueues.get(tabId) ?? []
  queue.push({ tabId, blocks, controller })
  tabBatchQueues.set(tabId, queue)

  if (!tabBatchTimers.has(tabId)) {
    const timer = setTimeout(() => {
      tabBatchTimers.delete(tabId)
      void flushTabQueue(tabId)
    }, BATCH_DEBOUNCE_MS)
    tabBatchTimers.set(tabId, timer)
  }
}

async function flushTabQueue(tabId: number): Promise<void> {
  const groups = tabBatchQueues.get(tabId)
  tabBatchQueues.delete(tabId)
  if (!groups || groups.length === 0) return

  // Drop groups whose pipeline was cancelled while they were waiting to flush.
  const liveGroups = groups.filter((g) => !g.controller.signal.aborted)
  if (liveGroups.length === 0) return

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
  const targetLanguage = await getUserTargetLanguage(supabase, session.user.id)

  console.info('[gloss+1] flushing batched pipeline request', {
    tabId,
    groupCount: liveGroups.length,
    blockCount: liveGroups.reduce((sum, g) => sum + g.blocks.length, 0),
  })

  const resultsByBlockId = await resolveBlocksBatched(liveGroups, targetLanguage, accessToken)

  for (const group of liveGroups) {
    tabControllers.get(group.tabId)?.delete(group.controller)
    if (group.controller.signal.aborted) continue

    const responseBlocks: PipelineResponse['blocks'] = []
    for (const block of group.blocks) {
      const result = resultsByBlockId.get(block.blockId)
      if (result) responseBlocks.push(result)
    }

    const response: PipelineResponse = {
      schemaVersion: 1,
      requestId: `batch-${Date.now()}`,
      blocks: responseBlocks,
    }

    try {
      await chrome.tabs.sendMessage(group.tabId, {
        type: PIPELINE_RESPONSE_MESSAGE,
        response,
        inputBlockCount: group.blocks.length,
      })
    } catch (error) {
      console.warn('[gloss+1] failed to send pipeline response to tab:', error)
    }
  }
}

async function resolveBlocksBatched(
  groups: PendingGroup[],
  targetLanguage: string,
  accessToken: string,
): Promise<Map<string, PipelineResponse['blocks'][0]>> {
  const results = new Map<string, PipelineResponse['blocks'][0]>()
  const allBlocks = groups.flatMap((g) => g.blocks)

  // Cache hits are resolved locally and never touch the network.
  const uncached: TextBlock[] = []
  for (const block of allBlocks) {
    const cached = await getBlockCache(block.text, targetLanguage)
    if (cached === undefined) {
      uncached.push(block)
      continue
    }
    console.info('[gloss+1] cache hit for block', block.blockId)
    if (cached.edits.length > 0) {
      results.set(block.blockId, {
        blockId: block.blockId,
        edits: cached.edits.map((e, i) => ({
          id: `${block.blockId}-${i}`,
          start: e.start,
          end: e.end,
          original: e.original,
          replacement: e.replacement,
          data: { score: e.score },
        })),
      })
    }
  }

  if (uncached.length === 0) return results

  console.info('[gloss+1] sending entire uncached batch in one request', {
    blockCount: uncached.length,
  })

  try {
    const entries = await callReplacementEdgeFunctionBatch(uncached, targetLanguage, accessToken)
    for (const entry of entries) {
      results.set(entry.blockId, entry)
    }
  } catch (error) {
    console.warn('[gloss+1] batched pipeline call failed:', error)
  }

  return results
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

interface EdgeFunctionBatchResponse {
  results: Array<{
    id: string
    replacements: Array<{
      start: number
      end: number
      original: string
      replacement: string
      score?: number
    }>
    error?: string
  }>
}

async function callReplacementEdgeFunctionBatch(
  blocks: TextBlock[],
  targetLanguage: string,
  accessToken: string,
): Promise<PipelineResponse['blocks']> {
  if (blocks.length === 0) return []

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  if (!supabaseUrl) return []

  const url = `${supabaseUrl}/functions/v1/replacement`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      items: blocks.map((block) => ({ id: block.blockId, text: block.text })),
      sourceLanguage: 'en',
      targetLanguage,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn(`[gloss+1] edge function ${res.status}:`, text)
    return []
  }

  const data: EdgeFunctionBatchResponse = await res.json()
  const blocksById = new Map(blocks.map((b) => [b.blockId, b]))
  const responseBlocks: PipelineResponse['blocks'] = []

  for (const result of data.results ?? []) {
    const block = blocksById.get(result.id)
    if (!block) continue

    if (result.error) {
      console.warn(`[gloss+1] pipeline error for block ${result.id}:`, result.error)
      continue
    }

    // Cache the result (including empty — so we don't retry blocks with no replacements)
    const cacheEdits = (result.replacements ?? []).map((rep) => ({
      start: rep.start,
      end: rep.end,
      original: rep.original,
      replacement: rep.replacement,
      score: rep.score ?? 0.5,
    }))
    void setBlockCache(block.text, targetLanguage, { edits: cacheEdits })

    if (cacheEdits.length === 0) continue

    const edits: InlineEdit[] = cacheEdits.map((e, i) => ({
      id: `${block.blockId}-${i}`,
      start: e.start,
      end: e.end,
      original: e.original,
      replacement: e.replacement,
      data: { score: e.score },
    }))

    responseBlocks.push({ blockId: block.blockId, edits })
  }

  return responseBlocks
}

// ── User profile helper ────────────────────────────────────────────────────────

const DEFAULT_TARGET_LANGUAGE = 'pt'

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
