import type { ContentToBackgroundMessage } from "@/shared/messages";

chrome.runtime.onMessage.addListener((message: ContentToBackgroundMessage) => {
  if (message.type === "PAGE_LOADED") {
    console.debug("[GlossPlusOne/background] Page loaded", {
      url: message.url,
      title: message.title,
    });
    return;
  }

  if (message.type === "REQUEST_PLAN") {
    console.debug("[GlossPlusOne/background] Received page content", {
      trigger: message.trigger,
      paragraphs: message.payload.paragraphs.length,
      wordCount: message.payload.totalWordCount,
      pageType: message.payload.pageType,
    });
  }
});
