export async function openExternalUrl(url: string): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    await chrome.tabs.create({ url });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
