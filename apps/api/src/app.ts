import cors from "cors"
import cookieParser from "cookie-parser"
import express, { type NextFunction } from "express"
import type { Env } from "@gloss/env"
import { createAuthRouter } from "./auth/routes/auth-router.js"

export function createApp(env: Env) {
    const app = express()
    app.set("trust proxy", 1)
    app.use(express.json())
    app.use(cookieParser())
    app.use(
        cors({
            origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true,
            credentials: true,
        }),
    )

    app.get("/health", (_req, res) => {
        res.json({ ok: true })
    })

    app.use("/auth", createAuthRouter(env))

    app.use((err: unknown, _req: express.Request, res: express.Response, _next: NextFunction) => {
        console.error(err)
        const msg = err instanceof Error ? err.message : "server error"
        res.status(500).json({ error: msg })
    })

    return app
}
