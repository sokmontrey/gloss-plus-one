const LANG_MAP: Record<string, string> = {
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  it: "it-IT",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
};

let currentText = "";

export function requestAndPlay(
  text: string,
  language: string,
  onLoadStart?: () => void,
  onLoadEnd?: () => void,
): void {
  if (!text.trim()) return;

  if (isPlaying() && currentText === text) {
    stopPlaying();
    onLoadEnd?.();
    return;
  }

  stopPlaying();
  currentText = text;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG_MAP[language] ?? "es-ES";
  utterance.rate = 0.85;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const langCode = LANG_MAP[language] ?? "es-ES";
  const match = voices.find((voice) => voice.lang.startsWith(langCode.split("-")[0]));
  if (match) utterance.voice = match;

  onLoadStart?.();
  utterance.onstart = () => onLoadEnd?.();
  utterance.onend = () => {
    currentText = "";
  };
  utterance.onerror = () => {
    currentText = "";
    onLoadEnd?.();
  };

  window.speechSynthesis.speak(utterance);
}

export function isPlaying(): boolean {
  return window.speechSynthesis.speaking;
}

export function stopPlaying(): void {
  window.speechSynthesis.cancel();
  currentText = "";
}

export function playAudio(dataUri: string, text: string): void {
  void dataUri;
  requestAndPlay(text, "es");
}
