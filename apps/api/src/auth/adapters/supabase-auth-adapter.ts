import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js"
import type {
    AuthAdapter,
    AuthSession,
    AuthTokens,
    AuthUser,
    GoogleOAuthCallbackParams,
} from "@gloss/shared/adapters/auth"
import { GOOGLE_AUTH_PROVIDER } from "@gloss/shared/adapters/auth"

/** Same values as createClient(); used for PKCE token URL + logout. */
export type SupabaseAuthAdapterConfig = {
    supabaseUrl: string
    /** Supabase anon / publishable key (public client). */
    supabasePublishableKey: string
    /**
     * Per-request client (Express: closure over req/res). Use PKCE + storage that survives the OAuth redirect
     * (e.g. cookie adapter). See https://supabase.com/docs/guides/auth/server-side/oauth-with-pkce-flow-for-ssr
     */
    getClient: () => SupabaseClient
}

function mapUser(user: Session["user"]): AuthUser {
    return {
        id: user.id,
        email: user.email ?? null,
        provider: GOOGLE_AUTH_PROVIDER,
    }
}

function mapSession(session: Session): AuthSession {
    const tokens: AuthTokens = {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at,
    }
    return { user: mapUser(session.user), tokens }
}

function authApiRoot(supabaseUrl: string): string {
    const base = supabaseUrl.replace(/\/+$/, "")
    return `${base}/auth/v1`
}

async function exchangePkce(
    config: Pick<SupabaseAuthAdapterConfig, "supabaseUrl" | "supabasePublishableKey">,
    authCode: string,
    codeVerifier: string,
): Promise<Session> {
    const res = await fetch(
        `${authApiRoot(config.supabaseUrl)}/token?grant_type=pkce`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: config.supabasePublishableKey,
                Authorization: `Bearer ${config.supabasePublishableKey}`,
            },
            body: JSON.stringify({
                auth_code: authCode,
                code_verifier: codeVerifier,
            }),
        },
    )
    const body = (await res.json()) as Record<string, unknown>
    if (!res.ok) {
        const msg =
            typeof body.error_description === "string"
                ? body.error_description
                : typeof body.msg === "string"
                  ? body.msg
                  : `token exchange failed (${res.status})`
        throw new Error(msg)
    }
    const session = body as unknown as Session
    if (!session.access_token || !session.user) throw new Error("invalid token response")
    return session
}

export function createSupabaseAuthAdapter(config: SupabaseAuthAdapterConfig): AuthAdapter {
    const { supabaseUrl, supabasePublishableKey, getClient } = config

    return {
        async getGoogleOAuthUrl(redirectTo, state) {
            const client = getClient()
            const { data, error } = await client.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                    queryParams: state ? { state } : undefined,
                },
            })
            if (error) throw new Error(error.message)
            if (!data.url) throw new Error("missing OAuth URL")
            return data.url
        },

        async completeGoogleOAuth(params: GoogleOAuthCallbackParams) {
            if (params.codeVerifier) {
                const session = await exchangePkce(config, params.code, params.codeVerifier)
                return mapSession(session)
            }
            const client = getClient()
            const { data, error } = await client.auth.exchangeCodeForSession(params.code)
            if (error) throw new Error(error.message)
            if (!data.session) throw new Error("no session")
            return mapSession(data.session)
        },

        async verifyAccessToken(accessToken) {
            const client = getClient()
            const { data, error } = await client.auth.getUser(accessToken)
            if (error || !data.user) return null
            return mapUser(data.user)
        },

        async refreshSession(refreshToken) {
            const client = getClient()
            const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken })
            if (error || !data.session) return null
            const s = data.session
            return {
                accessToken: s.access_token,
                refreshToken: s.refresh_token,
                expiresAt: s.expires_at,
            }
        },

        async revokeSession(accessToken) {
            const res = await fetch(
                `${authApiRoot(supabaseUrl)}/logout?scope=global`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        apikey: supabasePublishableKey,
                        Authorization: `Bearer ${accessToken}`,
                    },
                },
            )
            if (!res.ok && res.status !== 204) {
                const text = await res.text().catch(() => "")
                throw new Error(text || `logout failed (${res.status})`)
            }
        },
    }
}

/**
 * Convenience: server-side client with explicit PKCE + storage. Prefer wiring getClient yourself for cookie SSR.
 */
export function createSupabaseServerClient(
    supabaseUrl: string,
    supabasePublishableKey: string,
    storage: {
        getItem: (key: string) => Promise<string | null> | string | null
        setItem: (key: string, value: string) => Promise<void> | void
        removeItem: (key: string) => Promise<void> | void
    },
): SupabaseClient {
    return createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
            storage,
            flowType: "pkce",
            persistSession: true,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    })
}
