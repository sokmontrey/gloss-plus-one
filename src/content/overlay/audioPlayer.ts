let currentAudio: HTMLAudioElement | null = null;
let currentlyPlayingText = "";
let currentSpeechUtterance: SpeechSynthesisUtterance | null = null;
let currentPlaybackMode: "audio" | "speech" | "none" = "none";

const SPEECH_LANG_MAP: Record<string, string> = {
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-PT",
  it: "it-IT",
};

function getSpeechSynthesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

function getSpeechLang(language: string): string {
  return SPEECH_LANG_MAP[language] ?? language;
}

function pickVoice(language: string): SpeechSynthesisVoice | null {
  const speech = getSpeechSynthesis();
  if (!speech) {
    return null;
  }

  const targetLang = getSpeechLang(language).toLowerCase();
  const voices = speech.getVoices();

  return (
    voices.find((voice) => voice.lang.toLowerCase() === targetLang) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(targetLang.split("-")[0])) ??
    null
  );
}

function ensureAudio(): HTMLAudioElement {
  if (!currentAudio) {
    currentAudio = new Audio();
    currentAudio.playbackRate = 0.9;
    currentAudio.onended = () => {
      currentlyPlayingText = "";
      currentPlaybackMode = "none";
    };
  }

  return currentAudio;
}

function stopCurrentPlayback(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.removeAttribute("src");
    currentAudio.load();
  }

  const speech = getSpeechSynthesis();
  if (speech) {
    speech.cancel();
  }

  currentSpeechUtterance = null;
  currentlyPlayingText = "";
  currentPlaybackMode = "none";
}

function playSpeech(text: string, language: string): void {
  const speech = getSpeechSynthesis();
  if (!speech) {
    throw new Error("SPEECH_SYNTHESIS_UNAVAILABLE");
  }

  if (currentlyPlayingText === text && currentPlaybackMode === "speech" && speech.speaking) {
    stopCurrentPlayback();
    return;
  }

  stopCurrentPlayback();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = getSpeechLang(language);
  utterance.rate = 0.9;

  const voice = pickVoice(language);
  if (voice) {
    utterance.voice = voice;
  }

  utterance.onend = () => {
    currentlyPlayingText = "";
    currentPlaybackMode = "none";
    currentSpeechUtterance = null;
  };
  utterance.onerror = () => {
    currentlyPlayingText = "";
    currentPlaybackMode = "none";
    currentSpeechUtterance = null;
  };

  currentSpeechUtterance = utterance;
  currentlyPlayingText = text;
  currentPlaybackMode = "speech";
  speech.speak(utterance);
}

export function playAudio(dataUri: string, text: string): void {
  if (!dataUri || !text) {
    stopCurrentPlayback();
    return;
  }

  if (currentlyPlayingText === text && isPlaying(text)) {
    stopCurrentPlayback();
    return;
  }

  stopCurrentPlayback();
  const audio = ensureAudio();
  audio.src = dataUri;
  currentlyPlayingText = text;
  currentPlaybackMode = "audio";
  audio.play().catch((error) => {
    console.warn("[GlossPlusOne:audio] Playback failed:", error);
    currentlyPlayingText = "";
    currentPlaybackMode = "none";
  });
}

export function isPlaying(text: string): boolean {
  if (currentlyPlayingText !== text) {
    return false;
  }

  if (currentPlaybackMode === "audio") {
    return currentAudio !== null && !currentAudio.paused;
  }

  if (currentPlaybackMode === "speech") {
    const speech = getSpeechSynthesis();
    return speech !== null && speech.speaking;
  }

  return false;
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

        try {
          console.warn(
            "[GlossPlusOne:audio] Remote audio unavailable, using speech synthesis fallback:",
            response?.error ?? "AUDIO_FAILED",
          );
          playSpeech(text, language);
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error(response?.error ?? "AUDIO_FAILED"));
        }
      },
    );
  });
}
