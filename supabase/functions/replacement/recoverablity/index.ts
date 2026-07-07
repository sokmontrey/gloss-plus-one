export interface MlmToken {
  // I think the start and end is replacment cords
  text: string;
  start: number;
  end: number;
  score: number | null;
}

export interface RecoverablityService {
  score(text: string): Promise<number[]>;
}
