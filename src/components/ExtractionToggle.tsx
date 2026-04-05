import { useEffect, useState } from 'react'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { getExtractionEnabled, setExtractionEnabled } from '@/lib/settings'

const SHOW_MANUAL_EXTRACT = import.meta.env.DEV
const MANUAL_EXTRACT_MESSAGE = 'gloss-plus-one:manual-extract'

type ManualExtractionResponse =
  | { ok: true; url: string; totalBlocks: number; totalChars: number }
  | { ok: false; error: string }

export function ExtractionToggle() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    getExtractionEnabled()
      .then((value) => setEnabled(value))
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Failed to load extraction setting')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle() {
    const nextValue = !enabled

    setSaving(true)
    setError(null)
    setStatus(null)

    try {
      await setExtractionEnabled(nextValue)
      setEnabled(nextValue)
      setStatus(nextValue ? 'Automatic extraction enabled.' : 'Automatic extraction disabled.')
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

      const response = await chrome.tabs.sendMessage(tab.id, { type: MANUAL_EXTRACT_MESSAGE }) as ManualExtractionResponse | undefined
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

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant={enabled ? 'secondary' : 'outline'}
        size="sm"
        className="w-full gap-2"
        disabled={loading || saving || extracting}
        onClick={handleToggle}
      >
        {(loading || saving) && <Spinner size="sm" />}
        {loading
          ? 'Loading extraction setting…'
          : enabled
            ? 'Automatic extraction: On'
            : 'Automatic extraction: Off'}
      </Button>
      {SHOW_MANUAL_EXTRACT && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          disabled={loading || saving || extracting}
          onClick={handleManualExtract}
        >
          {extracting && <Spinner size="sm" />}
          {extracting ? 'Extracting current page…' : 'Extract Current Page'}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        {SHOW_MANUAL_EXTRACT
          ? 'Automatic mode runs on load, refresh, and route changes. Manual mode is available as a debug fallback.'
          : 'Automatic mode runs on load, refresh, and route changes.'}
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
