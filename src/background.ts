import type { ExtractionBatch, ExtractionResult } from '@/extraction'
import { getSupabase } from '@/lib/supabase'

const EXTRACTION_RESULT_MESSAGE = 'gloss-plus-one:extraction-result'
const EXTRACTION_BATCH_MESSAGE = 'gloss-plus-one:extraction-batch'

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/process-extraction`

const tabExtractions = new Map<number, {
  url: string
  batches: ExtractionBatch[]
  totalBlocks: number
  totalChars: number
}>()

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

chrome.tabs.onRemoved.addListener((tabId) => {
  tabExtractions.delete(tabId)
})

async function sendBatchToEdgeFunction(
  payload: {
    url: string
    title: string
    batch: ExtractionBatch
    extractedAt: string
    tabId: number
  },
  retried = false,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn('[gloss+1] Supabase client unavailable, skipping edge function call')
    return
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    console.warn('[gloss+1] No active session, skipping edge function call')
    return
  }

  let response: Response
  try {
    response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[gloss+1] Edge function fetch failed:', err)
    return
  }

  if (response.status === 401 && !retried) {
    // Token may have expired between the client's refresh cycle and this call — refresh and retry once
    const { error } = await supabase.auth.refreshSession()
    if (error) {
      console.warn('[gloss+1] Session refresh failed, dropping batch:', error.message)
      return
    }
    return sendBatchToEdgeFunction(payload, true)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error('[gloss+1] Edge function error:', response.status, body)
    return
  }

  console.info('[gloss+1] batch forwarded to edge function')
}

function handleExtractionBatch(
  message: { reason: string; batch: ExtractionBatch; url: string; title?: string },
  sender: chrome.runtime.MessageSender,
): void {
  const tabId = sender.tab?.id
  if (tabId === undefined) return

  const existing = tabExtractions.get(tabId)
  const extraction = !existing || existing.url !== message.url
    ? { url: message.url, batches: [], totalBlocks: 0, totalChars: 0 }
    : existing

  extraction.batches.push(message.batch)
  extraction.totalBlocks = message.batch.stats.cumulativeBlocks
  extraction.totalChars = message.batch.stats.cumulativeChars
  tabExtractions.set(tabId, extraction)

  void sendBatchToEdgeFunction({
    url: extraction.url,
    title: message.title ?? '',
    batch: message.batch,
    extractedAt: new Date().toISOString(),
    tabId,
  })

  console.info('[gloss+1] extraction batch received in service worker:', {
    // tabId,
    // url: extraction.url,
    reason: message.reason,
    // batch: message.batch,
    summary: {
      batches: extraction.batches.length,
      totalBlocks: extraction.totalBlocks,
      totalChars: extraction.totalChars,
    },
  })
}

function handleExtractionResult(
  reason: string,
  result: ExtractionResult,
  sender: chrome.runtime.MessageSender,
): void {
  const tabUrl = sender.tab?.url ?? 'unknown-tab'
  console.info('[gloss+1] extraction received in service worker:', {
    tabUrl,
    reason,
    result,
  })
}
