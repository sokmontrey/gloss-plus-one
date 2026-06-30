import type { Lexicon } from "../lexicon/index.ts";

export interface MlmToken {
  text: string;
  start: number;
  end: number;
  score: number | null;
}

export interface ScoredLexicon extends Lexicon {
  score: number | null;
}

export interface RecoverablityService {
  recoverableScore(
    text: string,
    start: number,
    end: number,
  ): Promise<number | null>;

  scoreLexicons(text: string, lexicons: Lexicon[]): Promise<ScoredLexicon[]>;
}
