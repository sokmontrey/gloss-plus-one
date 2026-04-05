export const EXTRACTION_ENABLED_KEY = 'gloss-plus-one.extraction-enabled'

export async function getExtractionEnabled(): Promise<boolean> {
  const value = await chrome.storage.local.get(EXTRACTION_ENABLED_KEY)
  return Boolean(value[EXTRACTION_ENABLED_KEY])
}

export async function setExtractionEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [EXTRACTION_ENABLED_KEY]: enabled })
}
