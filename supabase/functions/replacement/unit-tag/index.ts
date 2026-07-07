export interface Spans {
    start: number;
    end: number;
    id: number;
    text: string;
}

export interface UnitTagService {
    insert(text: string, spans: Spans[]): string;
    extract(text: string, spans: Spans[]): Spans[];
}
