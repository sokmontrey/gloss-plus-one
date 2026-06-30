import type { Lexicon } from "../lexicon/index.ts";
import type { MlmToken, RecoverablityService, ScoredLexicon } from "./index.ts";

const MLM_URL = Deno.env.get("MLM_URL") ?? "http://localhost:8002";

export class RecoverClass implements RecoverablityService {
  async recoverableScore(
    text: string,
    start: number,
    end: number,
  ): Promise<number | null> {
    const response = await fetch(`${MLM_URL}/recoverable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, start, end }),
    });

    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.score;
  }

  async scoreLexicons(
    text: string,
    lexicons: Lexicon[],
  ): Promise<ScoredLexicon[]> {
    if (lexicons.length === 0) return [];

    const includeRanges = lexicons.map((l) => ({
      start: l.start,
      end: l.end,
    }));

    const res = await fetch(`${MLM_URL}/recoverable_score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, include_ranges: includeRanges }),
    });

    if (!res.ok) {
      throw new Error(`mlm-service ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const mlmTokens: MlmToken[] = data.tokens ?? [];

    return lexicons.map((lex) => {
      const overlapping = mlmTokens.filter(
        (t) => t.score !== null && t.start < lex.end && t.end > lex.start,
      );

      let score: number | null = null;
      if (overlapping.length > 0) {
        const sum = overlapping.reduce((acc, t) => acc + (t.score as number), 0);
        score = sum / overlapping.length;
      }

      return {
        ...lex,
        score,
      };
    });
  }
}
