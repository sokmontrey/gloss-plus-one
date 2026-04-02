import type { AuthAdapter, AuthUser } from "@gloss-plus-one/shared/adapters/auth";
import type { Request, Response, NextFunction } from "express";

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
            /** Set when `Authorization: Bearer` succeeds; needed for RLS-scoped Supabase calls. */
            authAccessToken?: string;
        }
    }
}

const UNAUTHORIZED = { error: "Unauthorized" } as const;

export function createRequireAuthMiddleware(authAdapter: AuthAdapter) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ")) {
            return res.status(401).json(UNAUTHORIZED);
        }

        const token = header.slice(7).trim();
        if (!token) {
            return res.status(401).json(UNAUTHORIZED);
        }

        const user = await authAdapter.verifyAccessToken(token);
        if (!user) {
            return res.status(401).json(UNAUTHORIZED);
        }

        req.user = user;
        req.authAccessToken = token;
        next();
    };
}
