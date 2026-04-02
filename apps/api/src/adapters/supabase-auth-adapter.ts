import { createClient, type Session, type User } from "@supabase/supabase-js";
import { AuthError, type AuthAdapter } from "@gloss-plus-one/shared/adapters/auth";
import type { Env } from "../env.js";

export function createSupabaseAuthAdapter(env: Env): AuthAdapter {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
        auth: {
            autoRefreshToken: false,
            detectSessionInUrl: false,
            persistSession: false,
        },
    });

    return {
        async getGoogleOAuthUrl(params) {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: params.redirectTo,
                    skipBrowserRedirect: true,
                    queryParams: {
                        access_type: "offline",
                        ...(params.state ? { state: params.state } : {}),
                        ...(params.prompt ? { prompt: params.prompt } : {}),
                        ...(params.loginHint ? { login_hint: params.loginHint } : {}),
                    },
                },
            });

            if (error || !data.url) {
                throw new AuthError(
                    "PROVIDER_ERROR",
                    "Failed to create Google OAuth URL",
                    error,
                );
            }

            return data.url;
        },

        async completeGoogleOAuth(params) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);

            if (error || !data.session || !data.user) {
                throw new AuthError(
                    "OAUTH_FAILED",
                    "Failed to complete Google OAuth",
                    error,
                );
            }

            return toAuthSession(data.session, data.user);
        },

        async verifyAccessToken(accessToken: string) {
            const {
                data: { user },
                error,
            } = await supabase.auth.getUser(accessToken);

            if (error) {
                return null;
            }

            if (!user?.email) {
                return null;
            }

            return toAuthUser(user);
        },

        async refreshSession(refreshToken: string) {
            const { data, error } = await supabase.auth.refreshSession({
                refresh_token: refreshToken,
            });

            if (error) {
                if (error.status === 400 || error.status === 401 || error.status === 403) {
                    return null;
                }

                throw new AuthError(
                    "REFRESH_FAILED",
                    "Failed to refresh Supabase session",
                    error,
                );
            }

            if (!data.session || !data.user) {
                return null;
            }

            return toAuthSession(data.session, data.user);
        },

        async revokeSession(accessToken: string) {
            try {
                await supabase.auth.admin.signOut(accessToken);
            } catch {
                // Best-effort per adapter contract.
            }
        },
    };
}

function toAuthUser(user: User) {
    return {
        id: user.id,
        email: user.email ?? "",
        name: readOptionalString(user.user_metadata, "full_name")
            ?? readOptionalString(user.user_metadata, "name"),
        avatarUrl: readOptionalString(user.user_metadata, "avatar_url")
            ?? readOptionalString(user.user_metadata, "picture"),
        provider: "google" as const,
    };
}

function toAuthSession(session: Session, user: User) {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt =
        typeof session.expires_at === "number"
            ? session.expires_at
            : typeof session.expires_in === "number" && session.expires_in > 0
            ? now + session.expires_in
            : now + 3600; // 1hr fallback, Supabase default

    return {
        user: toAuthUser(user),
        tokens: {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt,
        },
    };
}

function readOptionalString(
    value: User["user_metadata"],
    key: string,
): string | undefined {
    const field = value?.[key];
    return typeof field === "string" && field.length > 0 ? field : undefined;
}
