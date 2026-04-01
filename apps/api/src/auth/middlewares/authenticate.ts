import type { NextFunction, Request, Response } from "express"
import type { Env } from "@gloss/env"
import { createAuthService } from "../services/auth-service.js"
import { COOKIE_ACCESS_TOKEN } from "../utils.js"

export function authenticate(env: Env) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const header = req.headers.authorization
        const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined
        const token = bearer ?? req.cookies[COOKIE_ACCESS_TOKEN]
        if (!token) {
            res.status(401).json({ error: "unauthorized" })
            return
        }
        const auth = createAuthService(env, req, res)
        const user = await auth.verifyAccessToken(token)
        if (!user) {
            res.status(401).json({ error: "unauthorized" })
            return
        }
        req.authUser = user
        next()
    }
}
