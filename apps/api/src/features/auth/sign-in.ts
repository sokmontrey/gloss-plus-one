import type { AuthAdapter, AuthSession, AuthUser } from "@gloss-plus-one/shared/adapters/auth";

/**
 * Orchestrates the auth adapter and user profile: one-way flow after OAuth.
 * Repositories/adapters do not call each other; this module is the seam.
 */
export type SignInServiceDeps = {
    authAdapter: AuthAdapter;
    /**
     * Must use a Supabase client scoped with `accessToken` (RLS) — not service role.
     */
    ensureProfileAfterSignIn: (user: AuthUser, accessToken: string) => Promise<void>;
};

export function createSignInService({
    authAdapter,
    ensureProfileAfterSignIn,
}: SignInServiceDeps) {
    return {
        async completeGoogleOAuthAndEnsureProfile(code: string): Promise<AuthSession> {
            const session = await authAdapter.completeGoogleOAuth({ code });
            await ensureProfileAfterSignIn(session.user, session.tokens.accessToken);
            return session;
        },
    };
}

export type SignInService = ReturnType<typeof createSignInService>;
