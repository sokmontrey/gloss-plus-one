let currentAudio: HTMLAudioElement | null = null;
let currentlyPlayingText = "";

function ensureAudio(): HTMLAudioElement {
  if (!currentAudio) {
    currentAudio = new Audio();
    currentAudio.playbackRate = 0.9;
    currentAudio.onended = () => {
      currentlyPlayingText = "";
    };
  }

  return currentAudio;
}

function stopCurrentAudio(): void {
  if (!currentAudio) {
    currentlyPlayingText = "";
    return;
  }

  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentAudio.removeAttribute("src");
  currentAudio.load();
  currentlyPlayingText = "";
}

export function playAudio(dataUri: string, text: string): void {
  if (!dataUri || !text) {
    stopCurrentAudio();
    return;
  }

  if (currentAudio && currentlyPlayingText === text && !currentAudio.paused) {
    stopCurrentAudio();
    return;
  }

  const audio = ensureAudio();
  audio.pause();
  audio.currentTime = 0;
  audio.src = dataUri;
  currentlyPlayingText = text;
  audio.play().catch((error) => {
    console.warn("[GlossPlusOne:audio] Playback failed:", error);
    currentlyPlayingText = "";
  });
}

export function isPlaying(text: string): boolean {
  return currentlyPlayingText === text && currentAudio !== null && !currentAudio.paused;
}

export async function requestAndPlay(
  text: string,
  language: string,
  onLoadStart?: () => void,
  onLoadEnd?: () => void,
): Promise<void> {
  onLoadStart?.();

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "REQUEST_AUDIO",
        payload: { text, language },
      },
      (response?: { dataUri?: string; error?: string }) => {
        onLoadEnd?.();

        if (response?.dataUri) {
          playAudio(response.dataUri, text);
          resolve();
          return;
        }

        reject(new Error(response?.error ?? "AUDIO_FAILED"));
      },
    );
  });
}
