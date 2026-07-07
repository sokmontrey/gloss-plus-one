import { Spans, UnitTagService } from "./index.ts";

export class XmlUnitTagService implements UnitTagService {
    insert(text: string, spans: Spans[]): string {
        const sorted = spans.toSorted((a, b) => a.start - b.start);

        const esc = (s: string) =>
            s
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

        const parts: string[] = [];
        let cursor = 0;
        for (const span of sorted) {
            parts.push(esc(text.slice(cursor, span.start)));
            parts.push(
                `<x${span.id}>${esc(text.slice(span.start, span.end))}</x${span.id}>`,
            );
            cursor = span.end;
        }
        parts.push(esc(text.slice(cursor)));
        return parts.join("");
    }

    extract(text: string, spans: Spans[]): Spans[] {
        const unesc = (s: string) =>
            s
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&amp;/g, "&");

        // restrict matching to only known ids, avoids picking up stray/injected tags
        const idPattern = spans.map((s) => s.id).join("|");
        if (!idPattern) return [];

        const regex = new RegExp(`<x(${idPattern})>([\\s\\S]*?)<\\/x\\1>`, "g");
        const found = new Map<number, string>();

        let m: RegExpExecArray | null;
        while ((m = regex.exec(text))) {
            found.set(Number(m[1]), unesc(m[2]));
        }

        return spans.map((span) => {
            const text = found.get(span.id);
            if (text === undefined) return span;
            return { ...span, text };
        });
    }
}
