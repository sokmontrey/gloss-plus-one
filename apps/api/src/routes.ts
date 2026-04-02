import { Router } from "express";
import { createAuthRoutes } from "./features/auth/auth-routes.js";
import type { Env } from "./env.js";
import { createSupabaseAuthAdapter } from "./adapters/supabase-auth-adapter.js";
import { createUserProfileRoutes } from "./features/user-profile/routes.js";
import { createUserProfileService } from "./features/user-profile/service.js";
import { createUserProfileRepository } from "./repositories/user-profile.js";
import { createSupabaseClient } from "./lib/supabase.js";
import { createAuthMiddleware } from "./middleware/auth-middleware.js";

export function createRoutes(env: Env) {
    const authAdapter = createSupabaseAuthAdapter(env);
    const authMiddleware = createAuthMiddleware(authAdapter);

    const supabaseClient = createSupabaseClient(env);
    const userProfileRepository = createUserProfileRepository({ supabaseClient });
    const userProfileService = createUserProfileService({ userProfileRepository });

    const router = Router();
    router.use("/auth", 
        createAuthRoutes({ authAdapter, env }));
    router.use("/user-profile",
        authMiddleware,
        createUserProfileRoutes({ userProfileService }),
    );
    return router;
}