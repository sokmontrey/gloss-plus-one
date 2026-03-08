import { isPlaying, playAudio, requestAndPlay } from "./audioPlayer";

const MIN_CHARS = 2;
const MAX_CHARS = 200;

let selectionEl: HTMLElement | null = null;
let currentLanguage = "es";
let listenersBound = false;

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
    <button
      id="gloss-selection-btn"
      style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        background: #1f2937;
        color: white;
        border: none;
        border-radius: 20px;
        font-size: 12px;
        font-family: system-ui;
        cursor: pointer;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      "
    >
      🔊 <span style="opacity:0.7;max-width:160px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(displayText)}</span>
    </button>
  `;

  root.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    left: ${Math.max(8, rect.left + rect.width / 2 - 80)}px;
    top: ${Math.max(8, rect.top - 44)}px;
    pointer-events: auto;
    display: block;
  `;

  const button = root.querySelector("#gloss-selection-btn");
  if (!(button instanceof HTMLElement)) {
    return;
  }

  button.addEventListener("click", () => {
    const label = button.querySelector("span");
    if (isPlaying(text)) {
      playAudio("", "");
      hideSelectionPlayer();
      return;
    }

    if (label instanceof HTMLElement) {
      label.textContent = "...";
    }
    button.style.background = "#92400e";

    void requestAndPlay(
      text,
      language,
      undefined,
      () => {
        const nextLabel = button.querySelector("span");
        if (nextLabel instanceof HTMLElement) {
          nextLabel.textContent = `⏹ ${displayText}`;
        }
      },
    ).catch(() => {
      hideSelectionPlayer();
    });
  });
}

export function initSelectionPlayer(language: string): void {
  currentLanguage = language;

  if (listenersBound) {
    return;
  }

  document.addEventListener("mouseup", () => {
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
    const target = event.target;
    if (target instanceof Element && target.closest("#gloss-selection-player")) {
      return;
    }

    hideSelectionPlayer();
  });

  listenersBound = true;
}
