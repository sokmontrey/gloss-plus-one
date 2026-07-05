export interface Spans {
    start: number;
    end: number;
    value: string;
    id: number;
}

export interface UnitTagService {
    insert(text: string, spans: Spans[]): string;
    extract(text: string, spans: Spans[]): Spans[];
}

export * from "./xml.ts";
