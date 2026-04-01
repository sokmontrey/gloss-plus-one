import { Router } from "express";
import type { AuthAdapter } from "@gloss-plus-one/shared/adapters/auth";

export function createAuthRoutes(authAdapter: AuthAdapter) {
    const router = Router();

    // TODO: add auth routes

    return router;
}