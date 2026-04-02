import { Router } from "express";
import { createAuthRouter } from "./features/auth/router.js";
import { createSignInService } from "./features/auth/sign-in.js";
import type { Env } from "./env.js";
import { createSupabaseAuthAdapter } from "./adapters/supabase-auth.js";
import { createUserProfileRouter } from "./features/user-profile/router.js";
import { createUserProfileService } from "./features/user-profile/service.js";
import { createUserProfileRepository } from "./features/user-profile/repository.js";
import { createSupabaseClient } from "./lib/supabase.js";
import { createRequireAuthMiddleware } from "./middleware/require-auth.js";

export function createRoutes(env: Env) {
    const authAdapter = createSupabaseAuthAdapter(env);
    const requireAuth = createRequireAuthMiddleware(authAdapter);

    const supabaseClient = createSupabaseClient(env);
    const userProfileRepository = createUserProfileRepository({ supabaseClient });
    const userProfileService = createUserProfileService({ userProfileRepository });
    const signInService = createSignInService({ authAdapter, userProfileService });

    const router = Router();
    router.use(
        "/auth",
        createAuthRouter({ authAdapter, signInService, env }),
    );
    router.use(
        "/user-profile",
        requireAuth,
        createUserProfileRouter({ userProfileService }),
    );
    return router;
}
