import type { Lexicon, LexiconService } from "./index.ts";

const LEXICON_URL = Deno.env.get("LEXICON_URL") ?? "http://localhost:8001";
const REPLACEABLE_TYPES = new Set(["function"]); // this means that only words like "the" -> "le" will be marked for replacing

export class LexiconClass implements LexiconService {
  async getReplaceableLexicons(text: string): Promise<Lexicon[]> {
    const res = await fetch(`${LEXICON_URL}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`lexicon-service ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const lexicons: Lexicon[] = data.lexicons ?? [];
    return lexicons.filter((l) => REPLACEABLE_TYPES.has(l.type));
  }
}
