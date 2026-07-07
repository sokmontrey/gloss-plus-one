import type { Lexicon } from "../lexicon/index.ts";
import type { TranslationItem, TranslationService } from "./index.ts";

export class TranslationClass implements TranslationService {
  private readonly TRANSLATION_URL =
    Deno.env.get("TRANSLATION_URL") ?? "http://localhost:8003";
  async translateLexicons(
    text: string,
    lexicons: Lexicon[],
    targetLang: string,
  ): Promise<TranslationItem[]> {
    const res = await fetch(`${this.TRANSLATION_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        lexicons: lexicons.map((l) => ({
          id: l.id,
          start: l.start,
          end: l.end,
          text: l.text,
        })),
        target_lang: targetLang,
      }),
    });

    if (!res.ok) {
      throw new Error(`translation-service ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return data.translations ?? [];
  }
}
