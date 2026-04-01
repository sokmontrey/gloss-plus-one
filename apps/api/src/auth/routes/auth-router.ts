import { randomBytes } from "node:crypto"
import { Router } from "express"
import type { Env } from "@gloss/env"
import { authenticate } from "../middlewares/authenticate.js"
import { createAuthService } from "../services/auth-service.js"
import {
    clearAuthCookies,
    COOKIE_ACCESS_TOKEN,
    COOKIE_OAUTH_NEXT,
    COOKIE_OAUTH_STATE,
    isExtensionUrl,
    publicUrl,
    safeNextUrl,
    setSessionCookies,
} from "../utils.js"

export function createAuthRouter(env: Env): Router {
    const r = Router()
    const secure = env.NODE_ENV === "production"

    r.get("/google", async (req, res, next) => {
        try {
            const nextUrl = safeNextUrl(typeof req.query.next === "string" ? req.query.next : undefined, env)
            const state = randomBytes(24).toString("hex")
            const short = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 10 * 60 * 1000 }
            res.cookie(COOKIE_OAUTH_STATE, state, short)
            res.cookie(COOKIE_OAUTH_NEXT, nextUrl, short)

            const auth = createAuthService(env, req, res)
            const callbackUrl = `${publicUrl(req)}/auth/google/callback`
            const url = await auth.getGoogleOAuthUrl(callbackUrl, state)
            res.redirect(302, url)
        } catch (e) {
            next(e)
        }
    })

    r.get("/google/callback", async (req, res, next) => {
        try {
            const code = typeof req.query.code === "string" ? req.query.code : undefined
            const state = typeof req.query.state === "string" ? req.query.state : undefined
            if (!code) {
                res.status(400).send("missing code")
                return
            }
            const expected = req.cookies[COOKIE_OAUTH_STATE]
            if (!state || !expected || state !== expected) {
                res.status(400).send("invalid oauth state")
                return
            }
            const nextUrl =
                typeof req.cookies[COOKIE_OAUTH_NEXT] === "string" ? req.cookies[COOKIE_OAUTH_NEXT] : "/"

            const auth = createAuthService(env, req, res)
            const sess = await auth.completeGoogleOAuth(code)
            clearAuthCookies(res, env.SUPABASE_URL, secure)

            if (isExtensionUrl(nextUrl)) {
                const target = new URL(nextUrl)
                target.hash = new URLSearchParams({
                    access_token: sess.tokens.accessToken,
                    refresh_token: sess.tokens.refreshToken ?? "",
                    expires_at: String(sess.tokens.expiresAt ?? ""),
                }).toString()
                res.redirect(302, target.toString())
                return
            }

            setSessionCookies(res, sess.tokens.accessToken, sess.tokens.refreshToken, secure)
            res.redirect(302, nextUrl)
        } catch (e) {
            next(e)
        }
    })

    r.post("/logout", async (req, res, next) => {
        try {
            const token = req.cookies[COOKIE_ACCESS_TOKEN]
            const auth = createAuthService(env, req, res)
            await auth.revokeSession(token).catch(() => {})
            clearAuthCookies(res, env.SUPABASE_URL, secure)
            res.status(204).end()
        } catch (e) {
            next(e)
        }
    })

    r.get("/me", authenticate(env), (req, res) => {
        res.json({ user: req.authUser })
    })

    return r
}
