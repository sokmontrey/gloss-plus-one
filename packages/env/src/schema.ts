import { z } from "zod"

const port = z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().int().positive().default(3000),
)

export const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    SB_AUTH_GOOGLE_CLIENT_ID: z.string().default(""),
    SB_AUTH_GOOGLE_SECRET: z.string().default(""),

    CORS_ORIGINS: z
        .string()
        .default("")
        .transform((s) =>
            s
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
        ),

    SUPABASE_URL: z
        .string()
        .min(1)
        .transform((s) => s.replace(/\/+$/, ""))
        .pipe(z.string().url()),

    SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().default(""),
    SUPABASE_JWT_SECRET: z.string().default(""),

    PORT: port,
})

export type Env = z.infer<typeof envSchema>
