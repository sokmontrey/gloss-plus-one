import type { AuthAdapter, AuthUser } from "@gloss-plus-one/shared/adapters/auth"
import type { Request, Response, NextFunction } from "express"

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser
        }
    }
}

export function createAuthMiddleware(auth: AuthAdapter) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const header = req.headers.authorization
        if (!header?.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Missing token" })
        }

        const token = header.slice(7).trim()
        if (!token) {
            return res.status(401).json({ error: "Missing token" })
        }

        const user = await auth.verifyAccessToken(token)
        if (!user) {
            return res.status(401).json({ error: "Invalid or expired token" })
        }

        req.user = user
        next()
    }
}