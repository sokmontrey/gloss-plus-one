export interface RecoverabilityToken {
    start: number;
    end: number;
    score: number;
}

export interface RecoverablityService {
    score(text: string): Promise<RecoverabilityToken[]>;
}
