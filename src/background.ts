import type { ExtractionBatch, ExtractionResult, PipelineResponse, TextBlock } from '@/extraction'

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

function handleExtractionBatch(
  message: { reason: string; batch: ExtractionBatch; url: string },
  sender: chrome.runtime.MessageSender,
): void {
  const tabId = sender.tab?.id
  if (tabId === undefined) return

  runPlaceholderPipeline({
    tabId,
    url: message.url,
    reason: message.reason,
    blocks: message.batch.blocks,
  })
}

function handleExtractionResult(
  reason: string,
  result: ExtractionResult,
  sender: chrome.runtime.MessageSender,
): void {
  const tabId = sender.tab?.id
  if (tabId === undefined) return

  runPlaceholderPipeline({
    tabId,
    url: result.url,
    reason,
    blocks: result.blocks,
  })
}

function runPlaceholderPipeline(payload: {
  tabId: number
  url: string
  reason: string
  blocks: TextBlock[]
}): void {
  const response = createPlaceholderPipelineResponse(payload.blocks)
  const editCount = response.blocks.reduce((count, block) => count + block.edits.length, 0)

  console.info('[gloss+1] placeholder pipeline response:', {
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

function createPlaceholderPipelineResponse(blocks: TextBlock[]): PipelineResponse {
  const requestId = `placeholder-${Date.now()}-${Math.random().toString(36).slice(2)}`

  return {
    schemaVersion: 1,
    requestId,
    blocks: blocks.map((block) => ({
      blockId: block.blockId,
      edits: findStandaloneI(block).map((start, index) => ({
        id: `${requestId}-${block.blockId}-${index}`,
        start,
        end: start + 1,
        original: 'I',
        replacement: 'Yo',
        highlight: { level: 'medium' as const },
        data: { source: 'placeholder-pipeline' },
      })),
    })).filter((block) => block.edits.length > 0),
    data: { source: 'placeholder-pipeline' },
  }
}

function findStandaloneI(block: TextBlock): number[] {
  const starts: number[] = []
  const pattern = /\bI\b/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(block.text)) !== null) {
    starts.push(match.index)
  }

  return starts
}
