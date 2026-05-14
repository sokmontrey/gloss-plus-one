import type { ExtractionBatch, ExtractionResult } from '@/extraction'

const EXTRACTION_RESULT_MESSAGE = 'gloss-plus-one:extraction-result'
const EXTRACTION_BATCH_MESSAGE = 'gloss-plus-one:extraction-batch'

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
  _sender: chrome.runtime.MessageSender,
): void {
  console.info('[gloss+1] extraction batch received:', {
    url: message.url,
    reason: message.reason,
    blockCount: message.batch.blocks.length,
  })
  // TODO: call replacement edge function
}

function handleExtractionResult(
  reason: string,
  result: ExtractionResult,
  _sender: chrome.runtime.MessageSender,
): void {
  console.info('[gloss+1] extraction result received:', {
    url: result.url,
    reason,
    blockCount: result.blocks.length,
  })
  // TODO: call replacement edge function
}
