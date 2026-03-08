import { isPlaying, requestAndPlay, stopPlaying } from "./audioPlayer";

const MIN_CHARS = 2;
const MAX_CHARS = 60;

let selectionEl: HTMLElement | null = null;
let currentLanguage = "es";
let listenersBound = false;
let selectionPlayerEnabled = true;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ensureSelectionEl(): HTMLElement {
  if (!selectionEl) {
    selectionEl = document.createElement("div");
    selectionEl.id = "gloss-selection-player";
    document.body.appendChild(selectionEl);
  }

  return selectionEl;
}

function hideSelectionPlayer(): void {
  if (selectionEl) {
    selectionEl.style.display = "none";
  }
}

export function setSelectionPlayerEnabled(enabled: boolean): void {
  selectionPlayerEnabled = enabled;

  if (!enabled) {
    hideSelectionPlayer();
  }
}

function showSelectionPlayer(text: string, language: string, selection: Selection): void {
  hideSelectionPlayer();

  if (selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return;
  }

  const root = ensureSelectionEl();
  const displayText = text.length > 30 ? `${text.slice(0, 30)}…` : text;

  root.innerHTML = `
    <div style="
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #1f2937;
      border-radius: 20px;
      padding: 3px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    ">
      <button id="gloss-selection-play" style="
        display: inline-flex; align-items: center; gap: 5px;
        padding: 4px 10px; background: transparent; color: white;
        border: none; border-radius: 16px; font-size: 12px;
        font-family: system-ui; cursor: pointer;
      ">
        🔊
        <span style="opacity:0.8;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${escapeHtml(displayText)}
        </span>
      </button>
      <button id="gloss-selection-add" style="
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 10px; background: rgba(251,191,36,0.2);
        color: rgba(251,191,36,1); border: none; border-radius: 16px;
        font-size: 12px; font-family: system-ui; cursor: pointer;
        white-space: nowrap;
      ">
        + Learn
      </button>
    </div>
  `;

  root.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    left: ${Math.max(8, rect.left + rect.width / 2 - 80)}px;
    top: ${Math.max(8, rect.top - 44)}px;
    pointer-events: auto;
    display: block;
  `;

  const playButton = root.querySelector("#gloss-selection-play");
  const addButton = root.querySelector("#gloss-selection-add");
  if (!(playButton instanceof HTMLElement) || !(addButton instanceof HTMLElement)) {
    return;
  }

  playButton.addEventListener("click", () => {
    const label = playButton.querySelector("span");
    if (isPlaying()) {
      stopPlaying();
      hideSelectionPlayer();
      return;
    }

    if (label instanceof HTMLElement) {
      label.textContent = "...";
    }
    playButton.style.background = "#92400e";

    requestAndPlay(
      text,
      language,
      () => {
        const nextLabel = playButton.querySelector("span");
        if (nextLabel instanceof HTMLElement) {
          nextLabel.textContent = "...";
        }
      },
      () => {
        const nextLabel = playButton.querySelector("span");
        if (nextLabel instanceof HTMLElement) {
          nextLabel.textContent = `⏹ ${displayText}`;
        }
        playButton.style.background = "#92400e";
      },
    );
  });

  addButton.addEventListener("click", () => {
    const addBtnEl = addButton as HTMLButtonElement;
    addBtnEl.disabled = true;
    addBtnEl.textContent = "...";

    const timeout = window.setTimeout(() => {
      addBtnEl.textContent = "timeout";
      addBtnEl.disabled = false;
    }, 8000);

    chrome.runtime.sendMessage(
      {
        type: "ADD_PHRASE_TO_BANK",
        payload: {
          phrase: text,
          language,
          sourceUrl: window.location.href,
          sourceTitle: document.title,
        },
      },
      (response: { success: boolean; targetPhrase?: string } | undefined) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          console.error(
            "[GlossPlusOne:selection] Add phrase error:",
            chrome.runtime.lastError.message,
          );
          addBtnEl.textContent = "error";
          addBtnEl.disabled = false;
          return;
        }
        if (response?.success) {
          addBtnEl.textContent = `✓ ${response.targetPhrase ?? "added"}`;
          addBtnEl.style.color = "rgba(251,191,36,1)";
          window.setTimeout(hideSelectionPlayer, 1800);
        } else {
          addBtnEl.textContent = "failed";
          addBtnEl.disabled = false;
        }
      },
    );
  });
}

export function initSelectionPlayer(language: string): void {
  currentLanguage = language;

  if (listenersBound) {
    return;
  }

  document.addEventListener("mouseup", () => {
    if (!selectionPlayerEnabled) {
      hideSelectionPlayer();
      return;
    }

    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";

    if (text.length < MIN_CHARS || text.length > MAX_CHARS) {
      hideSelectionPlayer();
      return;
    }

    if (!/[a-zA-Z\u00C0-\u017E]/.test(text) || !selection) {
      hideSelectionPlayer();
      return;
    }

    showSelectionPlayer(text, currentLanguage, selection);
  });

  document.addEventListener("mousedown", (event) => {
    if (!selectionPlayerEnabled) {
      hideSelectionPlayer();
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest("#gloss-selection-player")) {
      return;
    }

    hideSelectionPlayer();
  });

  listenersBound = true;
}
