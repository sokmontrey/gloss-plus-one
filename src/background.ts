console.info('[gloss+1] service worker started')

const EXTRACTION_RESULT_MESSAGE = 'gloss-plus-one:extraction-result'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== EXTRACTION_RESULT_MESSAGE) return undefined

  const tabUrl = sender.tab?.url ?? 'unknown-tab'
  console.info('[gloss+1] extraction received in service worker:', {
    tabUrl,
    reason: message.reason,
    result: message.result,
  })

  sendResponse({ ok: true })
  return false
})
