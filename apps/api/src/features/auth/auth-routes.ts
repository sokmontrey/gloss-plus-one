import {
    Router,
    type NextFunction,
    type Request,
    type Response,
} from "express";
import { randomUUID } from "node:crypto";
import {
    AuthError,
    type AuthAdapter,
} from "@gloss-plus-one/shared/adapters/auth";
import type { Env } from "../../env.js";

const OAUTH_STATE_COOKIE = "oauth_state";

function authErrorStatus(code: AuthError["code"]): number {
    switch (code) {
        case "INVALID_TOKEN":
        case "TOKEN_EXPIRED":
        case "USER_NOT_FOUND":
            return 401;
        case "OAUTH_FAILED":
            return 400;
        case "REFRESH_FAILED":
        case "PROVIDER_ERROR":
            return 502;
        default:
            return 500;
    }
}

function parseBearer(authorization: string | undefined): string | null {
    if (!authorization?.startsWith("Bearer ")) return null;
    const token = authorization.slice("Bearer ".length).trim();
    return token.length > 0 ? token : null;
}

function parsePrompt(
    value: unknown,
): GoogleOAuthPrompt | undefined {
    if (value === "consent" || value === "select_account" || value === "none") {
        return value;
    }
    return undefined;
}

type GoogleOAuthPrompt = "consent" | "select_account" | "none";

export type AuthRoutesProps = {
    authAdapter: AuthAdapter;
    env: Env;
}

export function createAuthRoutes({ authAdapter, env }: AuthRoutesProps): Router {
    const router = Router();

    router.post("/google/url", async (req, res, next) => {
        try {
            const state = randomUUID();

            res.cookie(OAUTH_STATE_COOKIE, state, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/api/auth/google/callback",
                maxAge: 10 * 60 * 1000,
            });

            const url = await authAdapter.getGoogleOAuthUrl({
                redirectTo: env.GOOGLE_OAUTH_REDIRECT_TO,
                state,
                prompt: parsePrompt(req.body?.prompt),
                loginHint:
                    typeof req.body?.loginHint === "string"
                        ? req.body.loginHint
                        : undefined,
            });
            res.json({ url });
        } catch (err) {
            next(err);
        }
    });

    router.get("/google/callback", async (req, res, next) => {
        try {
            const code = req.query.code;
            const state = req.query.state;
            if (typeof code !== "string" || code.length === 0) {
                res.status(400).json({ error: "code query parameter is required" });
                return;
            }
            if (typeof state !== "string" || state.length === 0) {
                res.status(400).json({ error: "state query parameter is required" });
                return;
            }

            const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
            res.clearCookie(OAUTH_STATE_COOKIE, { path: "/api/auth/google/callback" });

            if (typeof cookieState !== "string" || cookieState !== state) {
                next(new AuthError("OAUTH_FAILED", "Invalid OAuth state"));
                return;
            }

            const session = await authAdapter.completeGoogleOAuth({ code });
            const params = new URLSearchParams({
                access_token: session.tokens.accessToken,
                refresh_token: session.tokens.refreshToken,
                expires_at: String(session.tokens.expiresAt),
            });
            res.redirect(`${env.GOOGLE_OAUTH_CALLBACK_URL}#${params}`);
        } catch (err) {
            next(err);
        }
    });

    router.post("/refresh", async (req, res, next) => {
        try {
            const refreshToken = req.body?.refreshToken;
            if (typeof refreshToken !== "string" || refreshToken.length === 0) {
                res.status(400).json({ error: "refreshToken is required" });
                return;
            }

            const session = await authAdapter.refreshSession(refreshToken);
            if (!session) {
                res.status(401).json({ error: "invalid or expired refresh token" });
                return;
            }
            res.json(session);
        } catch (err) {
            next(err);
        }
    });

    router.get("/me", async (req, res, next) => {
        try {
            const token = parseBearer(req.headers.authorization);
            if (!token) {
                res.status(401).json({ error: "missing or invalid Authorization header" });
                return;
            }

            const user = await authAdapter.verifyAccessToken(token);
            if (!user) {
                res.status(401).json({ error: "invalid or expired access token" });
                return;
            }
            res.json({ user });
        } catch (err) {
            next(err);
        }
    });

    router.post("/logout", async (req, res, next) => {
        try {
            const token = parseBearer(req.headers.authorization);
            if (token) {
                await authAdapter.revokeSession(token);
            }
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    });

    router.use(
        (err: unknown, _req: Request, res: Response, next: NextFunction) => {
            if (err instanceof AuthError) {
                res.status(authErrorStatus(err.code)).json({
                    error: err.message,
                    code: err.code,
                });
                return;
            }
            next(err);
        },
    );

    return router;
}
