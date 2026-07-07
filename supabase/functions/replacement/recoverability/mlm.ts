import type { RecoverabilityToken, RecoverabilityService } from "./index.ts";

interface MlmRespond {
    tokens: RecoverabilityToken[];
    model: string;
}

export class MlmRecoverabilityService implements RecoverabilityService {
    private readonly mlmUrl: string;

    constructor(mlmUrl: string) {
        this.mlmUrl = mlmUrl ?? "http://localhost:8002/recoverable_score";
    }

    async score(text: string): Promise<RecoverabilityToken[]> {
        const response = await fetch(this.mlmUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error("Failed to score text");
        }

        const data = (await response.json()) as MlmRespond;
        return data.tokens;
    }
}
