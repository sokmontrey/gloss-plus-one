const EXTRACTION_SITES_KEY = 'gloss-plus-one.extraction-sites'
const LEGACY_ENABLED_KEY = 'gloss-plus-one.extraction-enabled'

export async function getEnabledSites(): Promise<string[]> {
  const result = await chrome.storage.local.get(EXTRACTION_SITES_KEY)
  const sites = result[EXTRACTION_SITES_KEY]
  return Array.isArray(sites) ? sites : []
}

export async function isSiteEnabled(host: string): Promise<boolean> {
  const sites = await getEnabledSites()
  return sites.includes(host)
}

export async function setSiteEnabled(host: string, enabled: boolean): Promise<void> {
  const sites = await getEnabledSites()
  const filtered = sites.filter((s) => s !== host)
  if (enabled) filtered.push(host)
  await chrome.storage.local.set({ [EXTRACTION_SITES_KEY]: filtered })
}

export async function clearLegacyKeys(): Promise<void> {
  await chrome.storage.local.remove(LEGACY_ENABLED_KEY)
}
