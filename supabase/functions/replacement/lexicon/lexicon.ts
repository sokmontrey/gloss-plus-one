import type { Lexicon, LexiconService } from "./index.ts";

export class LexiconClass implements LexiconService {
  private readonly LEXICON_URL =
    Deno.env.get("LEXICON_URL") ?? "http://localhost:8001";
  private readonly REPLACEABLE_TYPES = new Set(["function"]);

  async getReplaceableLexicons(text: string): Promise<Lexicon[]> {
    const res = await fetch(`${this.LEXICON_URL}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`lexicon-service ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const lexicons: Lexicon[] = data.lexicons ?? [];
    return lexicons.filter((l) => this.REPLACEABLE_TYPES.has(l.type));
  }
}
