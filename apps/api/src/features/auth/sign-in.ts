import type { AuthAdapter, AuthSession } from "@gloss-plus-one/shared/adapters/auth";
import type { UserProfileService } from "../user-profile/service.js";

/**
 * Orchestrates the auth adapter and user profile: one-way flow after OAuth.
 * Repositories/adapters do not call each other; this module is the seam.
 */
export type SignInServiceDeps = {
    authAdapter: AuthAdapter;
    userProfileService: UserProfileService;
};

export function createSignInService({
    authAdapter,
    userProfileService,
}: SignInServiceDeps) {
    return {
        async completeGoogleOAuthAndEnsureProfile(code: string): Promise<AuthSession> {
            const session = await authAdapter.completeGoogleOAuth({ code });
            await userProfileService.ensureProfileAfterSignIn(session.user);
            return session;
        },
    };
}

export type SignInService = ReturnType<typeof createSignInService>;
