const LANG_MAP: Record<string, string> = {
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  it: "it-IT",
};
const NORMAL_WEB_SPEECH_RATE = 0.85;
const NORMAL_AUDIO_PLAYBACK_RATE = 1;
const SLOW_PLAYBACK_RATE = 0.5;

let currentText = "";
let currentLanguage = "es";
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeAudioEl: HTMLAudioElement | null = null;
let activeMode: "elevenlabs" | "web-speech" | null = null;
let preferredLanguage = "es";
let playbackRequestId = 0;
const playbackCounts = new Map<string, number>();

function getAudioDebugState(synth: SpeechSynthesis | null) {
  return {
    currentText,
    currentLanguage,
    preferredLanguage,
    activeMode,
    speaking: Boolean(synth?.speaking),
    pending: Boolean(synth?.pending),
    paused: Boolean(synth?.paused),
    voiceCount: synth?.getVoices().length ?? 0,
    hasAudioElement: Boolean(activeAudioEl),
    audioPaused: activeAudioEl?.paused ?? null,
    audioEnded: activeAudioEl?.ended ?? null,
    playbackRequestId,
  };
}

function getSpeechSynthesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

function getLanguageTag(language: string): string {
  return LANG_MAP[language] ?? "es-ES";
}

function clearPlaybackState(): void {
  if (activeAudioEl) {
    activeAudioEl.pause();
    activeAudioEl.removeAttribute("src");
    activeAudioEl.load();
  }

  activeAudioEl = null;
  activeUtterance = null;
  activeMode = null;
  currentText = "";
  currentLanguage = preferredLanguage;
}

function isCurrentRequest(requestId: number): boolean {
  return requestId === playbackRequestId;
}

function getPlaybackKey(text: string, language: string): string {
  return `${language}::${text.trim().toLowerCase()}`;
}

function getNextPlaybackConfig(text: string, language: string): {
  key: string;
  attempt: number;
  isSlow: boolean;
  webSpeechRate: number;
  audioPlaybackRate: number;
} {
  const key = getPlaybackKey(text, language);
  const attempt = (playbackCounts.get(key) ?? 0) + 1;
  playbackCounts.set(key, attempt);
  const isSlow = attempt % 2 === 0;

  return {
    key,
    attempt,
    isSlow,
    webSpeechRate: isSlow ? SLOW_PLAYBACK_RATE : NORMAL_WEB_SPEECH_RATE,
    audioPlaybackRate: isSlow ? SLOW_PLAYBACK_RATE : NORMAL_AUDIO_PLAYBACK_RATE,
  };
}

export function setPreferredLanguage(language: string): void {
  preferredLanguage = language;
  console.log("[GlossPlusOne:audio] Preferred language set", {
    language,
    tag: getLanguageTag(language),
  });
}

function pickVoice(synth: SpeechSynthesis, language: string): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  const languageTag = getLanguageTag(language);
  const prefix = languageTag.split("-")[0];

  return (
    voices.find((voice) => voice.lang === languageTag) ??
    voices.find((voice) => voice.lang.startsWith(`${prefix}-`)) ??
    voices.find((voice) => voice.lang.startsWith(prefix)) ??
    null
  );
}

function requestElevenLabsAudio(text: string, language: string): Promise<string> {
  console.log("[GlossPlusOne:audio] Requesting ElevenLabs audio", {
    text,
    language,
  });

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "REQUEST_AUDIO",
        payload: { text, language },
      },
      (response: { dataUri?: string; error?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response?.dataUri) {
          resolve(response.dataUri);
          return;
        }

        reject(new Error(response?.error ?? "ELEVENLABS_AUDIO_UNAVAILABLE"));
      },
    );
  });
}

async function tryPlayElevenLabsAudio(
  dataUri: string,
  text: string,
  language: string,
  playbackRate: number,
  requestId: number,
  onLoadEnd?: () => void,
): Promise<boolean> {
  if (!isCurrentRequest(requestId)) {
    console.log("[GlossPlusOne:audio] Ignoring stale ElevenLabs playback", {
      text,
      language,
      requestId,
    });
    return false;
  }

  const audio = new Audio(dataUri);
  audio.preload = "auto";
  audio.playbackRate = playbackRate;
  activeAudioEl = audio;
  activeMode = "elevenlabs";

  audio.onplaying = () => {
    if (activeAudioEl !== audio) {
      return;
    }

    console.log("[GlossPlusOne:audio] ElevenLabs playback started", {
      text,
      language,
      playbackRate,
      requestId,
    });
    onLoadEnd?.();
  };

  audio.onended = () => {
    if (activeAudioEl !== audio) {
      return;
    }

    console.log("[GlossPlusOne:audio] ElevenLabs playback ended", {
      text,
      language,
      playbackRate,
      requestId,
    });
    clearPlaybackState();
  };

  audio.onerror = () => {
    console.error("[GlossPlusOne:audio] ElevenLabs playback error", {
      text,
      language,
      playbackRate,
      requestId,
      networkState: audio.networkState,
      readyState: audio.readyState,
      error: audio.error?.message ?? audio.error?.code ?? "UNKNOWN_AUDIO_ERROR",
    });
  };

  try {
    await audio.play();
    if (!isCurrentRequest(requestId)) {
      audio.pause();
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[GlossPlusOne:audio] ElevenLabs play() failed, falling back to Web Speech", {
      text,
      language,
      playbackRate,
      requestId,
      error: error instanceof Error ? error.message : error,
    });

    if (activeAudioEl === audio) {
      activeAudioEl = null;
      activeMode = null;
    }
    audio.pause();
    return false;
  }
}

function startWebSpeechPlayback(
  normalizedText: string,
  language: string,
  playbackRate: number,
  synth: SpeechSynthesis,
  onLoadEnd?: () => void,
): void {
  const utterance = new SpeechSynthesisUtterance(normalizedText);
  utterance.lang = getLanguageTag(language);
  utterance.rate = playbackRate;
  utterance.pitch = 1;
  utterance.volume = 1;
  activeUtterance = utterance;
  activeMode = "web-speech";

  const voice = pickVoice(synth, language);
  if (voice) {
    utterance.voice = voice;
  }

  console.log("[GlossPlusOne:audio] Prepared Web Speech utterance", {
    text: normalizedText,
    language,
    playbackRate,
    tag: utterance.lang,
    selectedVoice: voice
      ? {
          name: voice.name,
          lang: voice.lang,
          localService: voice.localService,
          default: voice.default,
        }
      : null,
    availableVoices: synth.getVoices().map((availableVoice) => ({
      name: availableVoice.name,
      lang: availableVoice.lang,
      default: availableVoice.default,
    })),
  });

  utterance.onstart = () => {
    console.log("[GlossPlusOne:audio] Web Speech utterance started", {
      text: normalizedText,
      language,
      playbackRate,
      ...getAudioDebugState(synth),
    });
    onLoadEnd?.();
  };
  utterance.onend = () => {
    if (activeUtterance !== utterance) {
      return;
    }

    console.log("[GlossPlusOne:audio] Web Speech utterance ended", {
      text: normalizedText,
      language,
      playbackRate,
      ...getAudioDebugState(synth),
    });
    clearPlaybackState();
  };
  utterance.onerror = (event) => {
    if (activeUtterance !== utterance) {
      return;
    }

    console.error("[GlossPlusOne:audio] Web Speech utterance error", {
      text: normalizedText,
      language,
      playbackRate,
      error: event.error,
      charIndex: event.charIndex,
      elapsedTime: event.elapsedTime,
      ...getAudioDebugState(synth),
    });
    clearPlaybackState();
    onLoadEnd?.();
  };

  if (synth.paused) {
    console.log("[GlossPlusOne:audio] Resuming paused synth before speak");
    synth.resume();
  }

  if (synth.getVoices().length === 0) {
    console.warn("[GlossPlusOne:audio] No voices available yet, waiting for voiceschanged");
    const handleVoicesChanged = () => {
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
      if (activeUtterance !== utterance || isPlaying()) {
        console.log("[GlossPlusOne:audio] voiceschanged ignored", {
          sameUtterance: activeUtterance === utterance,
          isPlaying: isPlaying(),
        });
        return;
      }

      const nextVoice = pickVoice(synth, language);
      if (nextVoice) {
        utterance.voice = nextVoice;
      }
      console.log("[GlossPlusOne:audio] voiceschanged resolved utterance voice", {
        selectedVoice: nextVoice
          ? {
              name: nextVoice.name,
              lang: nextVoice.lang,
              localService: nextVoice.localService,
              default: nextVoice.default,
            }
          : null,
        voiceCount: synth.getVoices().length,
      });
      synth.speak(utterance);
    };

    synth.addEventListener("voiceschanged", handleVoicesChanged);
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
      if (activeUtterance === utterance && !synth.speaking) {
        console.log("[GlossPlusOne:audio] voiceschanged timeout fallback speak", {
          text: normalizedText,
          language,
          playbackRate,
          voiceCount: synth.getVoices().length,
        });
        synth.speak(utterance);
      }
    }, 250);
    return;
  }

  console.log("[GlossPlusOne:audio] Calling speechSynthesis.speak", {
    text: normalizedText,
    language,
    playbackRate,
  });
  synth.speak(utterance);
}

export function requestAndPlay(
  text: string,
  language: string,
  onLoadStart?: () => void,
  onLoadEnd?: () => void,
): void {
  const normalizedText = text.trim();
  const synth = getSpeechSynthesis();
  if (!normalizedText) {
    console.warn("[GlossPlusOne:audio] Cannot play audio", {
      reason: "EMPTY_TEXT",
      text,
      language,
      hasSpeechSynthesis: Boolean(synth),
    });
    onLoadEnd?.();
    return;
  }

  console.log("[GlossPlusOne:audio] requestAndPlay called", {
    text: normalizedText,
    language,
    tag: getLanguageTag(language),
    ...getAudioDebugState(synth),
  });

  if (isPlaying() && currentText === normalizedText && currentLanguage === language) {
    console.log("[GlossPlusOne:audio] Toggling off current utterance", {
      text: normalizedText,
      language,
    });
    stopPlaying();
    onLoadEnd?.();
    return;
  }

  stopPlaying();
  const requestId = ++playbackRequestId;
  currentText = normalizedText;
  currentLanguage = language;
  preferredLanguage = language;
  const playbackConfig = getNextPlaybackConfig(normalizedText, language);

  onLoadStart?.();
  console.log("[GlossPlusOne:audio] Playback speed selected", playbackConfig);

  void (async () => {
    try {
      const dataUri = await requestElevenLabsAudio(normalizedText, language);
      console.log("[GlossPlusOne:audio] ElevenLabs audio generated", {
        text: normalizedText,
        language,
        playbackConfig,
        requestId,
        dataUriLength: dataUri.length,
      });

      const started = await tryPlayElevenLabsAudio(
        dataUri,
        normalizedText,
        language,
        playbackConfig.audioPlaybackRate,
        requestId,
        onLoadEnd,
      );
      if (started) {
        return;
      }
    } catch (error) {
      console.warn("[GlossPlusOne:audio] ElevenLabs generation failed, using Web Speech fallback", {
        text: normalizedText,
        language,
        playbackConfig,
        requestId,
        error: error instanceof Error ? error.message : error,
      });
    }

    if (!isCurrentRequest(requestId)) {
      console.log("[GlossPlusOne:audio] Stale fallback request ignored", {
        text: normalizedText,
        language,
        playbackConfig,
        requestId,
      });
      return;
    }

    if (!synth) {
      console.error("[GlossPlusOne:audio] No Web Speech fallback available", {
        text: normalizedText,
        language,
        playbackConfig,
        requestId,
      });
      clearPlaybackState();
      onLoadEnd?.();
      return;
    }

    startWebSpeechPlayback(
      normalizedText,
      language,
      playbackConfig.webSpeechRate,
      synth,
      onLoadEnd,
    );
  })();
}

export function isPlaying(): boolean {
  const synth = getSpeechSynthesis();
  return Boolean(
    synth?.speaking ||
    (activeAudioEl && !activeAudioEl.paused && !activeAudioEl.ended),
  );
}

export function stopPlaying(): void {
  const synth = getSpeechSynthesis();
  playbackRequestId += 1;
  console.log("[GlossPlusOne:audio] stopPlaying called", getAudioDebugState(synth));
  synth?.cancel();
  clearPlaybackState();
}

export function playAudio(dataUri: string, text: string): void {
  if (!dataUri) {
    requestAndPlay(text, preferredLanguage);
    return;
  }

  stopPlaying();
  const requestId = ++playbackRequestId;
  currentText = text.trim();
  currentLanguage = preferredLanguage;
  const playbackConfig = getNextPlaybackConfig(currentText, preferredLanguage);
  console.log("[GlossPlusOne:audio] Direct playAudio speed selected", playbackConfig);
  void tryPlayElevenLabsAudio(
    dataUri,
    currentText,
    preferredLanguage,
    playbackConfig.audioPlaybackRate,
    requestId,
  );
}
