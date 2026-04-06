import type { ExtractionBatch, ExtractionResult } from '@/extraction'
import { getSupabase } from '@/lib/supabase'

const EXTRACTION_RESULT_MESSAGE = 'gloss-plus-one:extraction-result'
const EXTRACTION_BATCH_MESSAGE = 'gloss-plus-one:extraction-batch'

const PROCESS_TEXT_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/process-text`

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

async function sendBatchToProcessText(
  payload: {
    url: string
    batch: ExtractionBatch
  },
  retried = false,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn('[gloss+1] Supabase client unavailable, skipping process-text call')
    return
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    console.warn('[gloss+1] No active session, skipping process-text call')
    return
  }

  // Fetch the user's target language from their profile.
  // Skip if not set — the user hasn't completed onboarding yet.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('target_language')
    .eq('user_id', session.user.id)
    .single()

  if (!profile?.target_language) {
    console.info('[gloss+1] No target language set, skipping process-text call')
    return
  }

  // Join block texts into a single string for the pipeline.
  const text = payload.batch.blocks.map((b) => b.text).join('\n')
  if (!text.trim()) return

  let response: Response
  try {
    response = await fetch(PROCESS_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        text,
        source_language: 'en',
        target_language: profile.target_language,
        max_new_words: 3,
        source_url: payload.url,
      }),
    })
  } catch (err) {
    console.error('[gloss+1] process-text fetch failed:', err)
    return
  }

  if (response.status === 401 && !retried) {
    const { error } = await supabase.auth.refreshSession()
    if (error) {
      console.warn('[gloss+1] Session refresh failed, dropping batch:', error.message)
      return
    }
    return sendBatchToProcessText(payload, true)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error('[gloss+1] process-text error:', response.status, body)
    return
  }

  const result = await response.json()
  console.info('[gloss+1] process-text response:', {
    stats: result.stats,
    newExposures: result.new_exposures?.length ?? 0,
  })
}

function handleExtractionBatch(
  message: { reason: string; batch: ExtractionBatch; url: string },
  sender: chrome.runtime.MessageSender,
): void {
  const tabId = sender.tab?.id
  if (tabId === undefined) return

  void sendBatchToProcessText({ url: message.url, batch: message.batch })

  console.info('[gloss+1] extraction batch received:', {
    reason: message.reason,
    batchBlocks: message.batch.stats.batchBlocks,
    batchChars: message.batch.stats.batchChars,
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
