import { Router } from "express";
import { createAuthRoutes } from "./features/auth/auth-routes.js";
import type { Env } from "./env.js";
import { createSupabaseAuthAdapter } from "./adapters/supabase-auth-adapter.js";

export function createRoutes(env: Env) {
    const authAdapter = createSupabaseAuthAdapter(env);

    const router = Router();
    router.use("/auth", createAuthRoutes({ authAdapter, env }));
    return router;
}