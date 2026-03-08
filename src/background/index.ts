import { getPhraseBank } from "@/background/memory/bankStore";
import { getUserContext, syncNarrativeToBackboard } from "@/background/memory/store";
import { routeBackgroundMessage } from "@/background/messaging/router";
import type { ContentToBackgroundMessage } from "@/shared/messages";

chrome.runtime.onMessage.addListener(
  (
    message: ContentToBackgroundMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    void routeBackgroundMessage(message, sender, sendResponse);
    return (
      message.type === "GET_BANK" ||
      message.type === "FETCH_DEFINITION" ||
      message.type === "REQUEST_AUDIO" ||
      message.type === "ADD_PHRASE_TO_BANK"
    );
  },
);

chrome.runtime.onSuspend.addListener(() => {
  void getUserContext().then((userContext) => {
    void getPhraseBank(userContext.targetLanguage).then((bank) => {
      void syncNarrativeToBackboard(bank, userContext);
    });
  });
});
