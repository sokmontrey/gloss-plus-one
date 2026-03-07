import { getPhraseState } from "@/background/memory/phraseStore";
import { getUserContext, syncNarrativeToBackboard } from "@/background/memory/store";
import { routeBackgroundMessage } from "@/background/messaging/router";
import type { ContentToBackgroundMessage } from "@/shared/messages";
chrome.runtime.onMessage.addListener(
  (message: ContentToBackgroundMessage, sender: chrome.runtime.MessageSender) => {
    void routeBackgroundMessage(message, sender);
  },
);

chrome.runtime.onSuspend.addListener(() => {
  void Promise.all([getPhraseState(), getUserContext()]).then(([phraseState, userContext]) => {
    void syncNarrativeToBackboard(phraseState, userContext);
  });
});
