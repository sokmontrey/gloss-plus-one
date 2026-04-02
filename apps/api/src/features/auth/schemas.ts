import { z } from "zod";

/** POST /auth/google/url */
export const googleOAuthUrlBodySchema = z
    .object({
        prompt: z.enum(["consent", "select_account", "none"]).optional(),
        loginHint: z.string().optional(),
    })
    .strict();

/** POST /auth/refresh */
export const refreshSessionBodySchema = z
    .object({
        refreshToken: z.string().min(1),
    })
    .strict();

const queryStringParam = z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    z.string().min(1),
);

/** GET /auth/google/callback — Express query values may be string | string[] */
export const googleOAuthCallbackQuerySchema = z.object({
    code: queryStringParam,
    state: queryStringParam,
});

export type GoogleOAuthUrlBodyDto = z.infer<typeof googleOAuthUrlBodySchema>;
