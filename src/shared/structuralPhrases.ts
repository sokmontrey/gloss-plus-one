export interface StructuralPhrase {
  phrase: string;
  tier: number;
}

export const STRUCTURAL_PHRASES: StructuralPhrase[] = [
  { phrase: "this is", tier: 1 },
  { phrase: "that is", tier: 1 },
  { phrase: "it is", tier: 1 },
  { phrase: "there is", tier: 1 },
  { phrase: "there are", tier: 1 },
  { phrase: "there were", tier: 1 },
  { phrase: "what is", tier: 1 },
  { phrase: "what are", tier: 1 },
  { phrase: "however", tier: 2 },
  { phrase: "therefore", tier: 2 },
  { phrase: "in addition", tier: 2 },
  { phrase: "as a result", tier: 2 },
  { phrase: "even though", tier: 2 },
  { phrase: "in order to", tier: 2 },
  { phrase: "on the other hand", tier: 2 },
  { phrase: "for example", tier: 2 },
  { phrase: "such as", tier: 2 },
  { phrase: "due to", tier: 2 },
  { phrase: "is able to", tier: 3 },
  { phrase: "in order to", tier: 3 },
  { phrase: "so that", tier: 3 },
  { phrase: "as well as", tier: 3 },
  { phrase: "not only", tier: 3 },
  { phrase: "because of", tier: 3 },
  { phrase: "according to", tier: 3 },
  { phrase: "in fact", tier: 3 },
  { phrase: "for instance", tier: 3 },
  { phrase: "in contrast", tier: 3 },
];

export function getActivePhrases(tier: number): StructuralPhrase[] {
  return STRUCTURAL_PHRASES.filter((phrase) => phrase.tier <= tier);
}
