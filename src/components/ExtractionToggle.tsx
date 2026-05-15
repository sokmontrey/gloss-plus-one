import { useEffect, useState } from 'react'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { isSiteEnabled, setSiteEnabled } from '@/lib/settings'

const SHOW_MANUAL_EXTRACT = import.meta.env.DEV
const MANUAL_EXTRACT_MESSAGE = 'gloss-plus-one:manual-extract'
const CONTENT_SCRIPT_RETRY_DELAYS_MS = [50, 150, 300, 600]

type ManualExtractionResponse =
  | { ok: true; url: string; totalBlocks: number; totalChars: number }
  | { ok: false; error: string }

export function ExtractionToggle() {
  const [enabled, setEnabled] = useState(false)
  const [host, setHost] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const tab = await getActiveTab()
      if (!tab?.url) {
        setLoading(false)
        return
      }

      try {
        const tabHost = new URL(tab.url).host
        setHost(tabHost)
        const siteEnabled = await isSiteEnabled(tabHost)
        setEnabled(siteEnabled)
      } catch {
        // chrome:// or other non-extractable URLs — host stays null
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [])

  async function handleToggle() {
    if (!host) return

    setSaving(true)
    setError(null)
    setStatus(null)

    try {
      const nextValue = !enabled
      await setSiteEnabled(host, nextValue)
      setEnabled(nextValue)
      setStatus(
        nextValue
          ? `Extraction enabled for ${host}.`
          : `Extraction disabled for ${host}.`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save extraction setting')
    } finally {
      setSaving(false)
    }
  }

  async function handleManualExtract() {
    setExtracting(true)
    setError(null)
    setStatus(null)

    try {
      const tab = await getActiveTab()
      if (!tab?.id) {
        throw new Error('No active browser tab found')
      }

      const response = await requestManualExtraction(tab.id)
      if (!response) {
        throw new Error('No response from content script')
      }

      if (!response.ok) {
        throw new Error(response.error)
      }

      setStatus(`Extracted ${response.totalBlocks} blocks from ${new URL(response.url).hostname}.`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Manual extraction failed'
      setError(message)
    } finally {
      setExtracting(false)
    }
  }

  const label = loading
    ? 'Loading…'
    : !host
      ? 'No active page'
      : enabled
        ? `Extraction: On for ${host}`
        : `Extraction: Off for ${host}`

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant={enabled ? 'secondary' : 'outline'}
        size="sm"
        className="w-full gap-2 truncate"
        disabled={loading || saving || extracting || !host}
        onClick={handleToggle}
      >
        {(loading || saving) && <Spinner size="sm" />}
        <span className="truncate">{label}</span>
      </Button>
      {SHOW_MANUAL_EXTRACT && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          disabled={loading || saving || extracting || !host}
          onClick={handleManualExtract}
        >
          {extracting && <Spinner size="sm" />}
          {extracting ? 'Extracting current page…' : 'Extract Current Page'}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        {SHOW_MANUAL_EXTRACT
          ? 'Automatic extraction is per-site. Manual extraction runs on demand regardless of this setting.'
          : 'Automatic extraction is enabled per-site. Runs on load, refresh, and route changes.'}
      </p>
      {status && <p className="text-xs text-muted-foreground">{status}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

async function requestManualExtraction(tabId: number): Promise<ManualExtractionResponse | undefined> {
  try {
    return await sendManualExtractionMessage(tabId)
  } catch (error) {
    if (!isMissingContentScriptError(error)) throw error
  }

  await injectContentScript(tabId)
  return await retryManualExtractionMessage(tabId)
}

async function sendManualExtractionMessage(tabId: number): Promise<ManualExtractionResponse | undefined> {
  return await chrome.tabs.sendMessage(tabId, { type: MANUAL_EXTRACT_MESSAGE }) as ManualExtractionResponse | undefined
}

async function injectContentScript(tabId: number): Promise<void> {
  const contentScriptFile = chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0]
  if (!contentScriptFile) {
    throw new Error('Content script is not listed in the extension manifest')
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [contentScriptFile],
  })
}

async function retryManualExtractionMessage(tabId: number): Promise<ManualExtractionResponse | undefined> {
  let lastError: unknown

  for (const delayMs of CONTENT_SCRIPT_RETRY_DELAYS_MS) {
    await delay(delayMs)

    try {
      return await sendManualExtractionMessage(tabId)
    } catch (error) {
      if (!isMissingContentScriptError(error)) throw error
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Content script did not start. Refresh the page and try again.')
}

function isMissingContentScriptError(error: unknown): boolean {
  return error instanceof Error
    && error.message.includes('Could not establish connection. Receiving end does not exist.')
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
