import { isPlaying, requestAndPlay, setPreferredLanguage, stopPlaying } from "./audioPlayer";

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

function computeSimpleDiff(original: string, modified: string): string {
  const oWords = original.split(/\s+/);
  const mWords = modified.split(/\s+/);
  
  const memo: number[][] = Array(oWords.length + 1).fill(0).map(() => Array(mWords.length + 1).fill(0));
  for (let i = 1; i <= oWords.length; i++) {
    for (let j = 1; j <= mWords.length; j++) {
      if (oWords[i - 1].toLowerCase() === mWords[j - 1].toLowerCase()) {
        memo[i][j] = memo[i - 1][j - 1] + 1;
      } else {
        memo[i][j] = Math.max(memo[i - 1][j], memo[i][j - 1]);
      }
    }
  }
  
  let i = oWords.length, j = mWords.length;
  const diff: { text: string; type: 'add' | 'remove' | 'keep' }[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oWords[i - 1].toLowerCase() === mWords[j - 1].toLowerCase()) {
      diff.unshift({ text: oWords[i - 1], type: 'keep' });
      i--; j--;
    } else if (j > 0 && (i === 0 || memo[i][j - 1] >= memo[i - 1][j])) {
      diff.unshift({ text: mWords[j - 1], type: 'add' });
      j--;
    } else if (i > 0 && (j === 0 || memo[i][j - 1] < memo[i - 1][j])) {
      diff.unshift({ text: oWords[i - 1], type: 'remove' });
      i--;
    }
  }
  
  return diff.map(d => {
    if (d.type === 'add') return `<span style="color: #34d399; font-weight: 500;">${escapeHtml(d.text)}</span>`;
    if (d.type === 'remove') return `<span style="color: #f87171; text-decoration: line-through;">${escapeHtml(d.text)}</span>`;
    return `<span style="color: #d1d5db;">${escapeHtml(d.text)}</span>`;
  }).join(" ");
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
    console.log("[GlossPlusOne:selection] Hiding selection player");
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

  console.log("[GlossPlusOne:selection] Showing selection player", {
    text,
    language,
    displayText,
    rangeCount: selection.rangeCount,
  });

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
      <button id="gloss-selection-tryout" style="
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 10px; background: rgba(59,130,246,0.2);
        color: rgba(59,130,246,1); border: none; border-radius: 16px;
        font-size: 12px; font-family: system-ui; cursor: pointer;
        white-space: nowrap;
      ">
        📝 Try out
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
  const tryOutButton = root.querySelector("#gloss-selection-tryout");
  if (!(playButton instanceof HTMLElement) || !(addButton instanceof HTMLElement) || !(tryOutButton instanceof HTMLElement)) {
    console.warn("[GlossPlusOne:selection] Selection player buttons not found after render");
    return;
  }

  playButton.addEventListener("mousedown", (event) => {
    console.log("[GlossPlusOne:selection] Play button mousedown");
    event.preventDefault();
    event.stopPropagation();
  });

  playButton.addEventListener("click", () => {
    const label = playButton.querySelector("span");
    console.log("[GlossPlusOne:selection] Selection TTS clicked", {
      text,
      language,
      displayText,
      currentlyPlaying: isPlaying(),
    });

    if (isPlaying()) {
      console.log("[GlossPlusOne:selection] Stopping active TTS from selection player");
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

  addButton.addEventListener("mousedown", (event) => {
    console.log("[GlossPlusOne:selection] Add button mousedown");
    event.preventDefault();
    event.stopPropagation();
  });

  addButton.addEventListener("click", () => {
    console.log("[GlossPlusOne:selection] Add phrase button clicked", {
      text,
      language,
      sourceUrl: window.location.href,
    });

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
        console.log("[GlossPlusOne:selection] Add phrase response received", {
          response,
          lastError: chrome.runtime.lastError?.message ?? null,
        });
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

  tryOutButton.addEventListener("mousedown", (event) => {
    console.log("[GlossPlusOne:selection] Try out button mousedown");
    event.preventDefault();
    event.stopPropagation();
  });

  tryOutButton.addEventListener("click", () => {
    console.log("[GlossPlusOne:selection] Try out button clicked", { text, language });
    root.innerHTML = `
      <div style="
        display: flex; flex-direction: column; gap: 8px;
        background: #1f2937; border-radius: 12px; padding: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3); min-width: 200px; max-width: 300px;
      ">
        <div style="color: #9ca3af; font-size: 12px; font-family: system-ui; margin-bottom: 4px;">
          Translate: <span style="color: white; font-weight: 500;">"${escapeHtml(displayText)}"</span>
        </div>
        <input id="gloss-tryout-input" type="text" placeholder="Type translation here..." style="
          width: 100%; box-sizing: border-box; padding: 8px 12px; border-radius: 8px;
          border: 1px solid #4b5563; background: #374151; color: white;
          font-size: 13px; font-family: system-ui; outline: none;
        " autocomplete="off" />
        <div id="gloss-tryout-result" style="display: none; flex-direction: column; gap: 4px; font-size: 12px; font-family: system-ui;">
        </div>
      </div>
    `;

    const input = root.querySelector("#gloss-tryout-input") as HTMLInputElement;
    const resultContainer = root.querySelector("#gloss-tryout-result") as HTMLElement;

    if (input) {
      input.focus();

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && input.value.trim()) {
          const userTranslation = input.value.trim();
          input.disabled = true;
          resultContainer.style.display = "flex";
          resultContainer.innerHTML = '<span style="color: #60a5fa;">Evaluating...</span>';

          chrome.runtime.sendMessage(
            {
              type: "ASSESS_TRANSLATION",
              payload: { phrase: text, userTranslation, language },
            },
            (response: { success: boolean; result?: { score: number; most_correct_translation: string; feedback: string } }) => {
              if (response?.success && response.result) {
                const { score, most_correct_translation, feedback } = response.result;
                const scoreColor = score >= 4 ? "#34d399" : score >= 2 ? "#fbbf24" : "#f87171";
                const diffHtml = computeSimpleDiff(userTranslation, most_correct_translation);

                resultContainer.innerHTML = `
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <span style="font-weight: bold; color: ${scoreColor};">Score: ${score}/5</span>
                  </div>
                  <div style="color: #e5e7eb; margin-top: 4px;">
                    <span style="color: #9ca3af;">Correction:</span> ${diffHtml}
                  </div>
                  <div style="color: #d1d5db; font-style: italic; margin-top: 2px;">
                    ${escapeHtml(feedback)}
                  </div>
                `;
                window.setTimeout(hideSelectionPlayer, 8000); // Wait longer so they can read feedback
              } else {
                resultContainer.innerHTML = '<span style="color: #f87171;">Failed to evaluate.</span>';
                input.disabled = false;
                input.focus();
              }
            }
          );
        } else if (e.key === "Escape") {
          hideSelectionPlayer();
        }
      });
    }
  });
}

export function initSelectionPlayer(language: string): void {
  currentLanguage = language;
  setPreferredLanguage(language);
  console.log("[GlossPlusOne:selection] initSelectionPlayer", {
    language,
    listenersBound,
  });

  if (listenersBound) {
    return;
  }

  document.addEventListener("mouseup", (event) => {
    if (!selectionPlayerEnabled) {
      hideSelectionPlayer();
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest("#gloss-selection-player")) {
      console.log("[GlossPlusOne:selection] Mouseup inside selection player, preserving popup");
      return;
    }

    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";

    console.log("[GlossPlusOne:selection] Document mouseup", {
      text,
      hasSelection: Boolean(selection),
      rangeCount: selection?.rangeCount ?? 0,
    });

    if (text.length < MIN_CHARS || text.length > MAX_CHARS) {
      console.log("[GlossPlusOne:selection] Selection length outside bounds, hiding popup", {
        length: text.length,
      });
      hideSelectionPlayer();
      return;
    }

    if (!/[a-zA-Z\u00C0-\u017E]/.test(text) || !selection) {
      console.log("[GlossPlusOne:selection] Selection missing letters or selection object, hiding popup");
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
      console.log("[GlossPlusOne:selection] Mousedown inside selection player");
      return;
    }

    console.log("[GlossPlusOne:selection] Outside mousedown, hiding selection player");
    hideSelectionPlayer();
  });

  listenersBound = true;
}
