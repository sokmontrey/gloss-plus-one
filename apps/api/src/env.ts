import { z } from "zod";

const envSchema = z.object({
    SB_AUTH_GOOGLE_CLIENT_ID: z.string().min(1),
    SB_AUTH_GOOGLE_SECRET: z.string().min(1),
    CORS_ORIGINS: z
        .string()
        .default("")
        .transform((s) =>
            s
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean),
        ),
    SUPABASE_URL: z.string().url(),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    SUPABASE_JWT_SECRET: z.string().min(1),
    PORT: z
        .preprocess(
            (v) => (v === "" || v === undefined ? "3000" : v),
            z.string(),
        )
        .transform((s) => Number.parseInt(s, 10))
        .pipe(z.number().int().min(1).max(65535)),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
