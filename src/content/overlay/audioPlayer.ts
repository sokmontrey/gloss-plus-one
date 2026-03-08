const LANG_MAP: Record<string, string> = {
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  it: "it-IT",
};

let currentText = "";
let currentLanguage = "es";
let activeUtterance: SpeechSynthesisUtterance | null = null;
let preferredLanguage = "es";

function getSpeechSynthesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

function getLanguageTag(language: string): string {
  return LANG_MAP[language] ?? "es-ES";
}

export function setPreferredLanguage(language: string): void {
  preferredLanguage = language;
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

export function requestAndPlay(
  text: string,
  language: string,
  onLoadStart?: () => void,
  onLoadEnd?: () => void,
): void {
  const normalizedText = text.trim();
  const synth = getSpeechSynthesis();
  if (!normalizedText || !synth) {
    onLoadEnd?.();
    return;
  }

  if (isPlaying() && currentText === normalizedText && currentLanguage === language) {
    stopPlaying();
    onLoadEnd?.();
    return;
  }

  stopPlaying();
  currentText = normalizedText;
  currentLanguage = language;
  preferredLanguage = language;

  const utterance = new SpeechSynthesisUtterance(normalizedText);
  utterance.lang = getLanguageTag(language);
  utterance.rate = 0.85;
  utterance.pitch = 1;
  utterance.volume = 1;
  activeUtterance = utterance;

  const voice = pickVoice(synth, language);
  if (voice) {
    utterance.voice = voice;
  }

  onLoadStart?.();
  utterance.onstart = () => onLoadEnd?.();
  utterance.onend = () => {
    currentText = "";
    currentLanguage = preferredLanguage;
    activeUtterance = null;
  };
  utterance.onerror = () => {
    currentText = "";
    currentLanguage = preferredLanguage;
    activeUtterance = null;
    onLoadEnd?.();
  };

  if (synth.paused) {
    synth.resume();
  }

  if (synth.getVoices().length === 0) {
    const handleVoicesChanged = () => {
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
      if (activeUtterance !== utterance || isPlaying()) {
        return;
      }

      const nextVoice = pickVoice(synth, language);
      if (nextVoice) {
        utterance.voice = nextVoice;
      }
      synth.speak(utterance);
    };

    synth.addEventListener("voiceschanged", handleVoicesChanged);
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
      if (activeUtterance === utterance && !synth.speaking) {
        synth.speak(utterance);
      }
    }, 250);
    return;
  }

  synth.speak(utterance);
}

export function isPlaying(): boolean {
  const synth = getSpeechSynthesis();
  return Boolean(synth?.speaking);
}

export function stopPlaying(): void {
  const synth = getSpeechSynthesis();
  synth?.cancel();
  currentText = "";
  currentLanguage = preferredLanguage;
  activeUtterance = null;
}

export function playAudio(_dataUri: string, text: string): void {
  requestAndPlay(text, preferredLanguage);
}
