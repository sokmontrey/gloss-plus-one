import type { CookieOptions, Request, Response } from "express"
import type { Env } from "@gloss/env"

export const COOKIE_ACCESS_TOKEN = "gp_access_token"
export const COOKIE_REFRESH_TOKEN = "gp_refresh_token"
export const COOKIE_OAUTH_STATE = "gp_oauth_state"
export const COOKIE_OAUTH_NEXT = "gp_oauth_next"

function cookieOptions(maxAgeSec: number, secure: boolean): CookieOptions {
    return {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeSec * 1000,
    }
}

function clearCookieOptions(secure: boolean): CookieOptions {
    return {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
    }
}

function supabaseSessionCookieName(supabaseUrl: string): string {
    const ref = new URL(supabaseUrl).hostname.split(".")[0]
    return `sb-${ref}-auth-token`
}

export function setSessionCookies(
    res: Response,
    accessToken: string,
    refreshToken: string | undefined,
    secure: boolean,
): void {
    res.cookie(COOKIE_ACCESS_TOKEN, accessToken, cookieOptions(55 * 60, secure))
    if (refreshToken) {
        res.cookie(COOKIE_REFRESH_TOKEN, refreshToken, cookieOptions(60 * 60 * 24 * 30, secure))
    }
}

export function clearAuthCookies(res: Response, supabaseUrl: string, secure: boolean): void {
    const options = clearCookieOptions(secure)
    res.clearCookie(COOKIE_ACCESS_TOKEN, options)
    res.clearCookie(COOKIE_REFRESH_TOKEN, options)
    res.clearCookie(COOKIE_OAUTH_STATE, options)
    res.clearCookie(COOKIE_OAUTH_NEXT, options)
    res.clearCookie(supabaseSessionCookieName(supabaseUrl), options)
}

export function safeNextUrl(next: string | undefined, env: Env): string {
    if (!next) return "/"
    if (next.startsWith("/") && !next.startsWith("//")) return next
    try {
        const url = new URL(next)
        if (url.protocol === "chrome-extension:") return next
        if (env.CORS_ORIGINS.some((origin) => origin === url.origin)) return next
    } catch {
        return "/"
    }
    return "/"
}

export function isExtensionUrl(value: string): boolean {
    try {
        return new URL(value).protocol === "chrome-extension:"
    } catch {
        return false
    }
}

export function publicUrl(req: Request): string {
    const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost"
    const proto = req.get("x-forwarded-proto") ?? req.protocol
    return `${proto}://${host}`
}
