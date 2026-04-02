import { config as loadEnv } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const envDir = dirname(fileURLToPath(import.meta.url));
/** Monorepo root (…/apps/api/src → up to package root → up to repo root). */
const repoRoot = join(envDir, "..", "..");
const apiPackageRoot = join(envDir, "..");
loadEnv({ path: join(repoRoot, ".env") });
loadEnv({ path: join(apiPackageRoot, ".env") });

const envSchema = z.object({
    SB_AUTH_GOOGLE_CLIENT_ID: z.string().min(1),
    SB_AUTH_GOOGLE_SECRET: z.string().min(1),
    GOOGLE_OAUTH_REDIRECT_TO: z.string().url(),
    GOOGLE_OAUTH_CALLBACK_URL: z.string().url(),
    CORS_ORIGINS: z
        .string()
        .default("")
        .transform((s) =>
            s
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean),
        )
        .superRefine((origins, ctx) => {
            if (origins.some((o) => o === "*" || o.includes("*"))) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message:
                        "CORS_ORIGINS must list explicit origins only (no *). For a browser extension use chrome-extension://<extension-id>.",
                });
            }
        }),
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

/** Parse env once at process startup (or pass a stub in tests). Throws ZodError if invalid. */
export function createEnv(source: NodeJS.ProcessEnv = process.env): Env {
    return envSchema.parse(source);
}
