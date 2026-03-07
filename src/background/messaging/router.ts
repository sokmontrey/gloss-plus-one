import { buildReplacementPlans } from "@/background/agent/planner";
import type { BackgroundToContentMessage, ContentToBackgroundMessage } from "@/shared/messages";

export async function routeBackgroundMessage(
  message: ContentToBackgroundMessage,
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  switch (message.type) {
    case "PAGE_LOADED": {
      console.debug("[GlossPlusOne/background] Page loaded", {
        url: message.url,
        title: message.title,
      });
      break;
    }

    case "REQUEST_PLAN": {
      console.log(
        `[GlossPlusOne:router] REQUEST_PLAN received — ${message.payload.paragraphs.length} paragraphs`,
      );
      const plans = await buildReplacementPlans(message.payload);
      const tabId = sender.tab?.id;

      if (typeof tabId !== "number") {
        console.warn("[GlossPlusOne/background] Cannot deliver PLAN_READY without tab id");
        break;
      }

      const response: BackgroundToContentMessage = {
        type: "PLAN_READY",
        payload: plans,
      };

      console.log(`[GlossPlusOne:router] PLAN_READY sending — ${plans.length} plans`);
      chrome.tabs.sendMessage(tabId, response).catch((error) => {
        console.warn("[GlossPlusOne/background] Failed to send PLAN_READY", error);
      });
      break;
    }

    default: {
      break;
    }
  }
}
