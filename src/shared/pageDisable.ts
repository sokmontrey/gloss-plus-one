const DISABLED_PAGES_KEY = "glossDisabledPages";

function toDisabledPageSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    return new Set();
  }

  return new Set(
    value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => normalizePageUrl(entry))
      .filter((entry): entry is string => entry !== null),
  );
}

export function normalizePageUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function isPageDisabledInSnapshot(url: string, snapshot: unknown): boolean {
  const normalizedUrl = normalizePageUrl(url);
  if (!normalizedUrl) {
    return false;
  }

  return toDisabledPageSet(snapshot).has(normalizedUrl);
}

export async function getDisabledPages(): Promise<Set<string>> {
  const result = await chrome.storage.local.get(DISABLED_PAGES_KEY);
  return toDisabledPageSet(result[DISABLED_PAGES_KEY]);
}

export async function isPageDisabled(url: string): Promise<boolean> {
  const normalizedUrl = normalizePageUrl(url);
  if (!normalizedUrl) {
    return false;
  }

  const disabledPages = await getDisabledPages();
  return disabledPages.has(normalizedUrl);
}

export async function setPageDisabled(url: string, disabled: boolean): Promise<boolean> {
  const normalizedUrl = normalizePageUrl(url);
  if (!normalizedUrl) {
    return false;
  }

  const disabledPages = await getDisabledPages();
  if (disabled) {
    disabledPages.add(normalizedUrl);
  } else {
    disabledPages.delete(normalizedUrl);
  }

  await chrome.storage.local.set({
    [DISABLED_PAGES_KEY]: [...disabledPages],
  });

  return disabledPages.has(normalizedUrl);
}

export { DISABLED_PAGES_KEY };
