import type { RecoverabilityToken, RecoverablityService } from "./index.ts";

export class MlmRecoverabilityService implements RecoverablityService {
    private readonly mlmUrl: string;

    constructor(mlmUrl: string) {
        this.mlmUrl = mlmUrl ?? "http://localhost:8002";
    }

    async score(text: string): Promise<RecoverabilityToken[]> {
        const response = await fetch(`${this.mlmUrl}/recoverable_score`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error("Failed to score text");
        }

        const data = await response.json();

        console.log(data);

        return data.score;
    }
}
