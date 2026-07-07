export interface RecoverabilityToken {
    start: number;
    end: number;
    score: number;
    text: string;
}

export interface RecoverabilityService {
    score(text: string): Promise<RecoverabilityToken[]>;
}
