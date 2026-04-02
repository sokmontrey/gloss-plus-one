import { Router } from "express";
import type { AuthAdapter } from "@gloss-plus-one/shared/adapters/auth";
import { createAuthRouter } from "./features/auth/router.js";
import type { SignInService } from "./features/auth/sign-in.js";
import { createUserProfileRouter } from "./features/user-profile/router.js";
import type { UserProfileServiceForAccessToken } from "./features/user-profile/service-factory.js";
import { createRequireAuthMiddleware } from "./middleware/require-auth.js";

/** Wire HTTP only — no raw `Env` / secrets here (composition root passes built deps). */
export type ApiRouterDeps = {
    authAdapter: AuthAdapter;
    signInService: SignInService;
    userProfileServiceForAccessToken: UserProfileServiceForAccessToken;
    /** Public OAuth URLs for routes (not secrets). */
    oauthRoutesConfig: {
        googleOAuthRedirectTo: string;
        googleOAuthCallbackUrl: string;
    };
};

export function createRoutes(deps: ApiRouterDeps): Router {
    const { authAdapter, signInService, userProfileServiceForAccessToken, oauthRoutesConfig } =
        deps;
    const requireAuth = createRequireAuthMiddleware(authAdapter);

    const router = Router();
    router.use(
        "/auth",
        createAuthRouter({ authAdapter, signInService, oauthRoutesConfig }),
    );
    router.use(
        "/user-profile",
        requireAuth,
        createUserProfileRouter({ userProfileServiceForAccessToken }),
    );
    return router;
}
