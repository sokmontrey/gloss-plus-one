import type {
  ExtractionBatch,
  ExtractionResult,
  PipelineResponse,
  TextBlock,
} from '@/extraction'
import { getSupabase } from '@/lib/supabase'

const EXTRACTION_RESULT_MESSAGE = 'gloss-plus-one:extraction-result'
const EXTRACTION_BATCH_MESSAGE = 'gloss-plus-one:extraction-batch'
const PIPELINE_RESPONSE_MESSAGE = 'gloss-plus-one:pipeline-response'

const PIPELINE_FUNCTION_NAME = 'replace-pipeline' as const

console.info('[gloss+1] service worker started')

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return undefined

  if (message.type === EXTRACTION_BATCH_MESSAGE) {
    void handleExtractionBatch(message, sender).then(() => sendResponse({ ok: true }))
    return true
  }

  if (message.type === EXTRACTION_RESULT_MESSAGE) {
    void handleExtractionResult(message.reason, message.result, sender).then(() =>
      sendResponse({ ok: true }))
    return true
  }

  return undefined
})

async function handleExtractionBatch(
  message: { reason: string; batch: ExtractionBatch; url: string },
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  const tabId = sender.tab?.id
  if (tabId === undefined) return

  await runPipelineFromEdge({
    tabId,
    url: message.url,
    reason: message.reason,
    blocks: message.batch.blocks,
  })
}

async function handleExtractionResult(
  reason: string,
  result: ExtractionResult,
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  const tabId = sender.tab?.id
  if (tabId === undefined) return

  await runPipelineFromEdge({
    tabId,
    url: result.url,
    reason,
    blocks: result.blocks,
  })
}

async function runPipelineFromEdge(payload: {
  tabId: number
  url: string
  reason: string
  blocks: TextBlock[]
}): Promise<void> {
  const response = await fetchPipelineResponse(payload)
  if (!response) return

  const editCount = response.blocks.reduce((count, block) => count + block.edits.length, 0)
  console.info('[gloss+1] pipeline edge response:', {
    requestId: response.requestId,
    url: payload.url,
    reason: payload.reason,
    blockCount: payload.blocks.length,
    editCount,
  })

  if (editCount === 0) return

  chrome.tabs.sendMessage(payload.tabId, {
    type: PIPELINE_RESPONSE_MESSAGE,
    response,
  }).catch((error) => {
    console.error('[gloss+1] failed to send pipeline response to content script:', error)
  })
}

async function fetchPipelineResponse(payload: {
  url: string
  reason: string
  blocks: TextBlock[]
}): Promise<PipelineResponse | null> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn('[gloss+1] pipeline skipped — Supabase env not configured')
    return null
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.warn('[gloss+1] pipeline skipped — no auth session')
    return null
  }

  const { data, error } = await supabase.functions.invoke<
    PipelineResponse
  >(PIPELINE_FUNCTION_NAME, {
    body: {
      schemaVersion: 1,
      url: payload.url,
      reason: payload.reason,
      blocks: payload.blocks.map((block) => ({
        blockId: block.blockId,
        text: block.text,
      })),
    },
  })

  if (error) {
    console.error('[gloss+1] edge pipeline invoke failed:', error)
    return null
  }

  if (!data || typeof data !== 'object' || data.schemaVersion !== 1) {
    console.error('[gloss+1] edge pipeline returned invalid body')
    return null
  }

  return data
}
