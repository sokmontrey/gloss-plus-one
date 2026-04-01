import { createClient } from "@supabase/supabase-js";
import { AuthError, type AuthAdapter } from "@gloss-plus-one/shared/adapters/auth";
import type { Env } from "../env.js";

export function createSupabaseAuthAdapter(env: Env): AuthAdapter {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);

    // TODO: implement the rest of the methods
    return {
        async getGoogleOAuthUrl() {
            throw new AuthError(
                "PROVIDER_ERROR",
                "getGoogleOAuthUrl not implemented for Supabase adapter",
            );
        },

        async completeGoogleOAuth() {
            throw new AuthError(
                "OAUTH_FAILED",
                "completeGoogleOAuth not implemented for Supabase adapter",
            );
        },

        async verifyAccessToken(accessToken: string) {
            const {
                data: { user },
                error,
            } = await supabase.auth.getUser(accessToken);
            if (error || !user?.email) return null;
            return {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.full_name as string | undefined,
                avatarUrl: user.user_metadata?.avatar_url as string | undefined,
                provider: "google",
            };
        },

        async refreshSession() {
            return null;
        },

        async revokeSession() {
            await supabase.auth.signOut();
        },
    };
}
