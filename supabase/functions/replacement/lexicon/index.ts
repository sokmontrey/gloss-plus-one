export interface Lexicon {
  id: number;
  start: number;
  end: number;
  text: string;
  type: string;
}

export interface LexiconService {
  getReplaceableLexicons(text: string): Promise<Lexicon[]>;
}
