import type { Request, Response } from "express"
import type { Env } from "@gloss/env"
import { createSupabaseAuthAdapter, createSupabaseServerClient } from "../adapters/supabase-auth-adapter.js"

// Request-scoped because Supabase PKCE storage reads/writes cookies on req/res.
export function createAuthService(env: Env, req: Request, res: Response) {
    const secure = env.NODE_ENV === "production"
    const cookieOptions = {
        httpOnly: true,
        secure,
        sameSite: "lax" as const,
        path: "/",
    }

    const auth = createSupabaseAuthAdapter({
        supabaseUrl: env.SUPABASE_URL,
        supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY,
        getClient: () =>
            createSupabaseServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
                getItem: (key: string): string | null => {
                    const value = req.cookies[key]
                    return typeof value === "string" ? value : null
                },
                setItem: (key: string, value: string): void => {
                    res.cookie(key, value, { ...cookieOptions, maxAge: 10 * 60 * 1000 })
                },
                removeItem: (key: string): void => {
                    res.clearCookie(key, cookieOptions)
                },
            }),
    })

    return {
        getGoogleOAuthUrl: auth.getGoogleOAuthUrl,
        completeGoogleOAuth(code: string) {
            return auth.completeGoogleOAuth({ code })
        },
        verifyAccessToken: auth.verifyAccessToken,
        async revokeSession(accessToken: string | undefined) {
            if (!accessToken) return
            await auth.revokeSession(accessToken)
        },
    }
}
