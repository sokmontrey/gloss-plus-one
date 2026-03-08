import type { UserContext } from "@/shared/types";

export const SUPPORTED_TARGET_LANGUAGES: UserContext["targetLanguage"][] = [
  "es",
  "fr",
  "de",
  "pt",
  "it",
];

export const TARGET_LANGUAGE_LABELS: Record<UserContext["targetLanguage"], string> = {
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
};
