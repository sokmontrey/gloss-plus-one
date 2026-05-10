import type { Session } from '@supabase/supabase-js'
import {
  LazyExtractor,
  extractBlockText,
  extractPageText,
  type ExtractionBatch,
  type ExtractionResult,
  type InlineEdit,
  type PipelineResponse,
  type TextBlock,
} from '@/extraction'
import { isSiteEnabled, clearLegacyKeys } from '@/lib/settings'
import { getSupabase } from '@/lib/supabase'
import contentStylesUrl from './index.css?url'

const EXTRACTION_DEBOUNCE_MS = 900
const SESSION_RETRY_DELAYS_MS = [0, 250, 500, 1000]
const URL_WATCH_INTERVAL_MS = 1000
const NAVIGATION_EVENT = 'gloss-plus-one:navigation'
const MANUAL_EXTRACT_MESSAGE = 'gloss-plus-one:manual-extract'
const EXTRACTION_RESULT_MESSAGE = 'gloss-plus-one:extraction-result'
const EXTRACTION_BATCH_MESSAGE = 'gloss-plus-one:extraction-batch'
const PIPELINE_RESPONSE_MESSAGE = 'gloss-plus-one:pipeline-response'

type ManualExtractionResponse =
  | { ok: true; url: string; totalBlocks: number; totalChars: number }
  | { ok: false; error: string }

let extractionTimer: number | null = null
let urlWatchTimer: number | null = null
let urlObserver: MutationObserver | null = null
let lastObservedUrl = window.location.href
let lastManualExtractionUrl: string | null = null
let lastLazyStartUrl: string | null = null
let activeExtractor: LazyExtractor | null = null
const blockRegistry = new Map<string, TextBlock>()

const contentWindow = window as typeof window & {
  __glossPlusOneContentLoaded?: boolean
  __glossPlusOneHistoryPatched?: boolean
}

function extensionStylesheetHref(url: string): string {
  if (url.startsWith('chrome-extension://')) return url
  const path = url.startsWith('/') ? url.slice(1) : url
  return chrome.runtime.getURL(path)
}

initializeContentScript()

function initializeContentScript(): void {
  if (contentWindow.__glossPlusOneContentLoaded) return
  contentWindow.__glossPlusOneContentLoaded = true

  const mount = document.createElement('div')
  mount.id = 'gloss-plus-one-root'
  mount.setAttribute('data-gloss-plus-one', '')
  Object.assign(mount.style, {
    all: 'initial',
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    zIndex: '2147483647',
  })
  document.documentElement.append(mount)

  const shadow = mount.attachShadow({ mode: 'open' })
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = extensionStylesheetHref(contentStylesUrl)
  shadow.append(link)
  shadow.append(document.createElement('div'))

  patchHistoryMethods()
  registerManualExtractionListener()
  registerPipelineResponseListener()
  registerAutomaticExtractionListeners()
  registerStorageChangeListener()
  primeInitialExtraction()
  void clearLegacyKeys()
}

function registerManualExtractionListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== MANUAL_EXTRACT_MESSAGE) return undefined

    void handleManualExtraction().then(sendResponse)
    return true
  })
}

function registerPipelineResponseListener(): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== PIPELINE_RESPONSE_MESSAGE) return undefined

    applyPipelineResponse(message.response as PipelineResponse)
    return false
  })
}

function registerAutomaticExtractionListeners(): void {
  window.addEventListener(NAVIGATION_EVENT, () => scheduleExtraction('history-change'))
  window.addEventListener('popstate', () => scheduleExtraction('popstate'))
  window.addEventListener('hashchange', () => scheduleExtraction('hashchange'))
  window.addEventListener('pageshow', () => {
    lastObservedUrl = window.location.href
    lastLazyStartUrl = null
    ensureUrlWatchers()
    scheduleExtraction('pageshow')
  })
  window.addEventListener('pagehide', () => {
    clearScheduledExtraction()
    stopUrlWatchers()
    stopLazyExtractor()
  })
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUrlChange('visibilitychange')
      ensureUrlWatchers()
      return
    }

    clearScheduledExtraction()
  })

  ensureUrlWatchers()
}

function primeInitialExtraction(): void {
  lastObservedUrl = window.location.href

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureUrlWatchers()
      scheduleExtraction('dom-content-loaded')
    }, { once: true })
    return
  }

  ensureUrlWatchers()
  scheduleExtraction('initial-load')
}

function patchHistoryMethods(): void {
  if (contentWindow.__glossPlusOneHistoryPatched) {
    return
  }

  contentWindow.__glossPlusOneHistoryPatched = true

  const wrapHistoryMethod = <T extends 'pushState' | 'replaceState'>(methodName: T) => {
    const original = history[methodName]

    history[methodName] = function patchedHistoryMethod(this: History, ...args: Parameters<History[T]>) {
      const result = original.apply(this, args)
      window.dispatchEvent(new Event(NAVIGATION_EVENT))
      return result
    } as History[T]
  }

  wrapHistoryMethod('pushState')
  wrapHistoryMethod('replaceState')
}

function registerStorageChangeListener(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    if (!('gloss-plus-one.extraction-sites' in changes)) return
    void runExtraction('storage-change')
  })
}

function scheduleExtraction(reason: string): void {
  clearScheduledExtraction()

  extractionTimer = window.setTimeout(() => {
    extractionTimer = null
    void runExtraction(reason)
  }, EXTRACTION_DEBOUNCE_MS)
}

function clearScheduledExtraction(): void {
  if (extractionTimer === null) return

  window.clearTimeout(extractionTimer)
  extractionTimer = null
}

function ensureUrlWatchers(): void {
  if (urlWatchTimer === null) {
    urlWatchTimer = window.setInterval(() => checkForUrlChange('interval'), URL_WATCH_INTERVAL_MS)
  }

  if (!urlObserver && document.documentElement) {
    urlObserver = new MutationObserver(() => checkForUrlChange('mutation'))
    urlObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    })
  }
}

function stopUrlWatchers(): void {
  if (urlWatchTimer !== null) {
    window.clearInterval(urlWatchTimer)
    urlWatchTimer = null
  }

  urlObserver?.disconnect()
  urlObserver = null
}

function checkForUrlChange(reason: string): void {
  const currentUrl = window.location.href
  if (currentUrl === lastObservedUrl) return

  lastObservedUrl = currentUrl
  lastLazyStartUrl = null
  stopLazyExtractor()
  scheduleExtraction(`url-change-${reason}`)
}

async function runExtraction(reason: string): Promise<void> {
  const host = new URL(window.location.href).host
  if (!(await isSiteEnabled(host))) {
    lastLazyStartUrl = null
    stopLazyExtractor()
    return
  }

  const session = await getAuthedSession()
  if (!session) return
  if (!document.body) return

  const currentUrl = window.location.href
  if (activeExtractor && lastLazyStartUrl === currentUrl) {
    return
  }

  startLazyExtraction(reason)
}

function startLazyExtraction(reason: string): void {
  if (!document.body) return

  stopLazyExtractor()
  activeExtractor = new LazyExtractor(
    { rootMargin: '300px' },
    (batch) => {
      registerBlocks(batch.blocks)
      void forwardBatchToBackground(reason, batch)
    },
  )
  activeExtractor.start(document.body)
  lastLazyStartUrl = window.location.href
}

function stopLazyExtractor(): void {
  activeExtractor?.stop()
  activeExtractor = null
}

async function handleManualExtraction(): Promise<ManualExtractionResponse> {
  const result = await extractCurrentPage({
    ignoreDuplicateUrl: true,
    updateLastExtractedUrl: true,
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  if (await isSiteEnabled(new URL(window.location.href).host)) {
    startLazyExtraction('manual-kickstart')
  }

  return {
    ok: true,
    url: result.result.url,
    totalBlocks: result.result.stats.totalBlocks,
    totalChars: result.result.stats.totalChars,
  }
}

async function extractCurrentPage(options: {
  ignoreDuplicateUrl: boolean
  updateLastExtractedUrl: boolean
}): Promise<
  | { ok: true; result: ExtractionResult }
  | { ok: false; error: string }
> {
  if (!document.body) {
    return { ok: false, error: 'Document body is not ready yet' }
  }

  const session = await getAuthedSession()
  if (!session) {
    return { ok: false, error: 'You must be signed in to extract pages' }
  }

  const currentUrl = window.location.href
  if (!options.ignoreDuplicateUrl && lastManualExtractionUrl === currentUrl) {
    return { ok: false, error: 'This page was already extracted for the current URL' }
  }

  try {
    const result = extractPageText(document.body)
    registerBlocks(result.blocks)

    if (options.updateLastExtractedUrl) {
      lastManualExtractionUrl = currentUrl
    }

    await forwardExtractionToBackground('manual-extract', result)
    return { ok: true, result }
  } catch (error) {
    console.error('[gloss+1] extraction failed:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Extraction failed',
    }
  }
}

async function getAuthedSession(): Promise<Session | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  for (const delayMs of SESSION_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await delay(delayMs)
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session) return session
  }

  return null
}

function registerBlocks(blocks: TextBlock[]): void {
  for (const block of blocks) {
    blockRegistry.set(block.blockId, block)
  }
}

function applyPipelineResponse(response: PipelineResponse): void {
  let appliedEdits = 0
  let skippedEdits = 0

  for (const blockResponse of response.blocks) {
    const block = blockRegistry.get(blockResponse.blockId)
    if (!block) {
      console.warn('[gloss+1] skipped pipeline block with no registry entry:', blockResponse.blockId)
      skippedEdits += blockResponse.edits.length
      continue
    }

    const element = resolveElementPath(block.path)
    if (!element) {
      console.warn('[gloss+1] skipped pipeline block with stale path:', block.path)
      skippedEdits += blockResponse.edits.length
      continue
    }

    const currentBlock = extractBlockText(element, document.body, block.sequence)
    if (!currentBlock) {
      skippedEdits += blockResponse.edits.length
      continue
    }

    const validEdits = getValidNonOverlappingEdits(currentBlock.text, blockResponse.edits)
    skippedEdits += blockResponse.edits.length - validEdits.length

    for (const edit of validEdits.sort((a, b) => b.start - a.start)) {
      if (applyInlineEdit(element, currentBlock.text, edit)) {
        appliedEdits += 1
      } else {
        skippedEdits += 1
      }
    }
  }

  console.info('[gloss+1] applied pipeline response:', {
    requestId: response.requestId,
    appliedEdits,
    skippedEdits,
  })
}

function getValidNonOverlappingEdits(text: string, edits: InlineEdit[]): InlineEdit[] {
  const sorted = [...edits].sort((a, b) => a.start - b.start)
  const valid: InlineEdit[] = []
  let previousEnd = -1

  for (const edit of sorted) {
    if (edit.start < 0 || edit.end > text.length || edit.start >= edit.end) continue
    if (edit.start < previousEnd) continue
    if (text.slice(edit.start, edit.end) !== edit.original) continue

    valid.push(edit)
    previousEnd = edit.end
  }

  return valid
}

function applyInlineEdit(element: Element, text: string, edit: InlineEdit): boolean {
  const occurrence = countOriginalOccurrences(text.slice(0, edit.start), edit.original)
  const target = findOriginalOccurrenceInTextNodes(element, edit.original, occurrence)
  if (!target) return false

  const span = document.createElement('span')
  span.textContent = edit.replacement
  span.dataset.glossPlusOneEditId = edit.id
  span.dataset.glossPlusOneOriginal = edit.original
  span.style.borderBottom = getHighlightBorder(edit)

  const range = document.createRange()
  range.setStart(target.node, target.start)
  range.setEnd(target.node, target.end)
  range.deleteContents()
  range.insertNode(span)
  return true
}

function countOriginalOccurrences(text: string, original: string): number {
  return findOriginalMatches(text, original).length
}

function findOriginalOccurrenceInTextNodes(
  element: Element,
  original: string,
  occurrence: number,
): { node: Text; start: number; end: number } | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text) || !node.parentElement) return NodeFilter.FILTER_REJECT
      if (node.parentElement.closest('[data-gloss-plus-one-edit-id]')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  let seen = 0

  while (walker.nextNode()) {
    const node = walker.currentNode
    if (!(node instanceof Text)) continue

    for (const match of findOriginalMatches(node.textContent ?? '', original)) {
      if (seen === occurrence) {
        return { node, start: match.start, end: match.end }
      }
      seen += 1
    }
  }

  return null
}

function findOriginalMatches(text: string, original: string): Array<{ start: number; end: number }> {
  if (!original) return []

  const matches: Array<{ start: number; end: number }> = []
  let start = 0

  while (start < text.length) {
    const index = text.indexOf(original, start)
    if (index === -1) break

    matches.push({ start: index, end: index + original.length })
    start = index + original.length
  }

  return matches
}

function getHighlightBorder(edit: InlineEdit): string {
  if (edit.highlight?.borderStyle) return edit.highlight.borderStyle

  const color = edit.highlight?.color
  if (color) return `2px solid ${color}`

  switch (edit.highlight?.level) {
    case 'low':
      return '1px solid #fde68a'
    case 'high':
      return '3px solid #eab308'
    case 'medium':
    default:
      return '2px solid #facc15'
  }
}

function resolveElementPath(path: string): Element | null {
  if (!document.body) return null

  let current: Element = document.body
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const first = parsePathSegment(segments[0])
  const startIndex = first?.tagName === current.tagName ? 1 : 0

  for (const segment of segments.slice(startIndex)) {
    const parsed = parsePathSegment(segment)
    if (!parsed) return null

    const candidates = Array.from(current.children).filter((child) => child.tagName === parsed.tagName)
    const next = candidates[parsed.index]
    if (!next) return null
    current = next
  }

  return current
}

function parsePathSegment(segment: string): { tagName: string; index: number } | null {
  const match = /^(?<tagName>[A-Z0-9-]+)\[(?<index>\d+)\]$/.exec(segment)
  if (!match?.groups) return null

  return {
    tagName: match.groups.tagName,
    index: Number.parseInt(match.groups.index, 10),
  }
}

async function forwardBatchToBackground(reason: string, batch: ExtractionBatch): Promise<void> {
  console.info('[gloss+1] extraction batch (page, raw):', {
    reason,
    url: window.location.href,
    joinedText: batch.blocks.map((b) => b.text).join('\n'),
    batch,
  })
  try {
    await chrome.runtime.sendMessage({
      type: EXTRACTION_BATCH_MESSAGE,
      reason,
      batch,
      url: window.location.href,
    })
  } catch (error) {
    console.error('[gloss+1] failed to forward extraction batch to service worker:', error)
  }
}

async function forwardExtractionToBackground(
  reason: string,
  result: ExtractionResult,
): Promise<void> {
  console.info('[gloss+1] extraction result (page, raw):', { reason, result })
  try {
    await chrome.runtime.sendMessage({
      type: EXTRACTION_RESULT_MESSAGE,
      reason,
      result,
    })
  } catch (error) {
    console.error('[gloss+1] failed to forward extraction to service worker:', error)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
