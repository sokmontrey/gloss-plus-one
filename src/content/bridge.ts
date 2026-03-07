import type { PageContent } from "./reader/types";
import type {
  ContentToBackgroundMessage,
  SerializablePageContent,
  ReplacementInstruction,
} from "@/shared/messages";

function toSerializablePageContent(content: PageContent): SerializablePageContent {
  return {
    ...content,
    paragraphs: content.paragraphs.map((p) => ({
      index: p.index,
      text: p.text,
      wordCount: p.wordCount,
      domPath: p.domPath,
      readingOrder: p.readingOrder,
    })),
  };
}

function sendMessage(message: ContentToBackgroundMessage) {
  chrome.runtime.sendMessage(message).catch((error) => {
    console.warn("[GlossPlusOne] Failed to send message", error);
  });
}

export function sendPageLoaded() {
  sendMessage({
    type: "PAGE_LOADED",
    url: window.location.href,
    title: document.title,
    at: Date.now(),
  });
}

export function sendRequestPlan(trigger: "initial" | "mutation", content: PageContent) {
  sendMessage({
    type: "REQUEST_PLAN",
    trigger,
    payload: toSerializablePageContent(content),
  });
}

/** Register a handler for APPLY_OUTPUT messages from the background. */
export function onApplyOutput(handler: (payload: ReplacementInstruction[]) => void) {
  chrome.runtime.onMessage.addListener(
    (message: { type?: string; payload?: ReplacementInstruction[] }) => {
      if (message.type === "APPLY_OUTPUT" && message.payload) {
        handler(message.payload);
      }
    }
  );
}

