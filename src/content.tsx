import type { Session } from '@supabase/supabase-js'
import { extractPageText } from '@/extraction'
import { getExtractionEnabled } from '@/lib/settings'
import { getSupabase } from '@/lib/supabase'
import contentStylesUrl from './index.css?url'

const EXTRACTION_DEBOUNCE_MS = 900
const SESSION_RETRY_DELAYS_MS = [0, 250, 500, 1000]
const URL_WATCH_INTERVAL_MS = 1000
const NAVIGATION_EVENT = 'gloss-plus-one:navigation'
const MANUAL_EXTRACT_MESSAGE = 'gloss-plus-one:manual-extract'
const EXTRACTION_RESULT_MESSAGE = 'gloss-plus-one:extraction-result'

type ManualExtractionResponse =
  | { ok: true; url: string; totalBlocks: number; totalChars: number }
  | { ok: false; error: string }

let extractionTimer: number | null = null
let urlWatchTimer: number | null = null
let urlObserver: MutationObserver | null = null
let lastObservedUrl = window.location.href
let lastExtractedUrl: string | null = null

function extensionStylesheetHref(url: string): string {
  if (url.startsWith('chrome-extension://')) return url
  const path = url.startsWith('/') ? url.slice(1) : url
  return chrome.runtime.getURL(path)
}

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
registerAutomaticExtractionListeners()
primeInitialExtraction()

function registerManualExtractionListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== MANUAL_EXTRACT_MESSAGE) return undefined

    void handleManualExtraction().then(sendResponse)
    return true
  })
}

function registerAutomaticExtractionListeners(): void {
  window.addEventListener(NAVIGATION_EVENT, () => scheduleExtraction('history-change'))
  window.addEventListener('popstate', () => scheduleExtraction('popstate'))
  window.addEventListener('hashchange', () => scheduleExtraction('hashchange'))
  window.addEventListener('pageshow', () => {
    lastObservedUrl = window.location.href
    lastExtractedUrl = null
    scheduleExtraction('pageshow')
  })
  window.addEventListener('pagehide', () => {
    clearScheduledExtraction()
    stopUrlWatchers()
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
  if ((window as typeof window & { __glossPlusOneHistoryPatched?: boolean }).__glossPlusOneHistoryPatched) {
    return
  }

  const patchedWindow = window as typeof window & { __glossPlusOneHistoryPatched?: boolean }
  patchedWindow.__glossPlusOneHistoryPatched = true

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
  lastExtractedUrl = null
  scheduleExtraction(`url-change-${reason}`)
}

async function runExtraction(reason: string): Promise<void> {
  await extractCurrentPage({
    reason,
    requireEnabled: true,
    ignoreDuplicateUrl: false,
    updateLastExtractedUrl: true,
  })
}

async function handleManualExtraction(): Promise<ManualExtractionResponse> {
  const result = await extractCurrentPage({
    reason: 'manual-extract',
    requireEnabled: false,
    ignoreDuplicateUrl: true,
    updateLastExtractedUrl: true,
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  return {
    ok: true,
    url: result.result.url,
    totalBlocks: result.result.stats.totalBlocks,
    totalChars: result.result.stats.totalChars,
  }
}

async function extractCurrentPage(options: {
  reason: string
  requireEnabled: boolean
  ignoreDuplicateUrl: boolean
  updateLastExtractedUrl: boolean
}): Promise<
  | { ok: true; result: ReturnType<typeof extractPageText> }
  | { ok: false; error: string }
> {
  if (options.requireEnabled && !(await getExtractionEnabled())) {
    return { ok: false, error: 'Automatic extraction is disabled' }
  }

  if (!document.body) {
    return { ok: false, error: 'Document body is not ready yet' }
  }

  const session = await getAuthedSession()
  if (!session) {
    return { ok: false, error: 'You must be signed in to extract pages' }
  }

  const currentUrl = window.location.href
  if (!options.ignoreDuplicateUrl && lastExtractedUrl === currentUrl) {
    return { ok: false, error: 'This page was already extracted for the current URL' }
  }

  try {
    const result = extractPageText(document.body)

    if (options.updateLastExtractedUrl) {
      lastExtractedUrl = currentUrl
    }

    await forwardExtractionToBackground(options.reason, result)
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

async function forwardExtractionToBackground(
  reason: string,
  result: ReturnType<typeof extractPageText>,
): Promise<void> {
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
