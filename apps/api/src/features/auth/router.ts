import {
    Router,
    type CookieOptions,
    type NextFunction,
    type Request,
    type Response,
} from "express";
import { randomUUID } from "node:crypto";
import {
    AuthError,
    type AuthAdapter,
} from "@gloss-plus-one/shared/adapters/auth";
import type { SignInService } from "./sign-in.js";
import {
    googleOAuthUrlBodySchema,
    googleOAuthCallbackQuerySchema,
    refreshSessionBodySchema,
} from "./schemas.js";

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_STATE_COOKIE_PATH = "/api/auth/google/callback";

function oauthStateCookieOptions(): CookieOptions {
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: OAUTH_STATE_COOKIE_PATH,
        maxAge: 10 * 60 * 1000,
    };
}

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

export type AuthRouterDeps = {
    authAdapter: AuthAdapter;
    signInService: SignInService;
    oauthRoutesConfig: {
        googleOAuthRedirectTo: string;
        googleOAuthCallbackUrl: string;
    };
};

export function createAuthRouter({
    authAdapter,
    signInService,
    oauthRoutesConfig,
}: AuthRouterDeps): Router {
    const router = Router();

    router.post("/google/url", async (req, res, next) => {
        try {
            const parsed = googleOAuthUrlBodySchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                res.status(400).json({
                    error: "Invalid request body",
                    details: parsed.error.flatten(),
                });
                return;
            }

            const state = randomUUID();

            res.cookie(OAUTH_STATE_COOKIE, state, oauthStateCookieOptions());

            const url = await authAdapter.getGoogleOAuthUrl({
                redirectTo: oauthRoutesConfig.googleOAuthRedirectTo,
                state,
                prompt: parsed.data.prompt,
                loginHint: parsed.data.loginHint,
            });
            res.json({ url });
        } catch (err) {
            next(err);
        }
    });

    router.get("/google/callback", async (req, res, next) => {
        try {
            const parsed = googleOAuthCallbackQuerySchema.safeParse(req.query);
            if (!parsed.success) {
                res.status(400).json({
                    error: "Invalid callback query",
                    details: parsed.error.flatten(),
                });
                return;
            }

            const { code, state } = parsed.data;

            const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
            const clearStateCookie = () =>
                res.clearCookie(OAUTH_STATE_COOKIE, {
                    path: OAUTH_STATE_COOKIE_PATH,
                    httpOnly: true,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                });
            clearStateCookie();

            if (typeof cookieState !== "string" || cookieState !== state) {
                next(new AuthError("OAUTH_FAILED", "Invalid OAuth state"));
                return;
            }

            const session = await signInService.completeGoogleOAuthAndEnsureProfile(code);
            const params = new URLSearchParams({
                access_token: session.tokens.accessToken,
                refresh_token: session.tokens.refreshToken,
                expires_at: String(session.tokens.expiresAt),
            });
            res.redirect(`${oauthRoutesConfig.googleOAuthCallbackUrl}#${params}`);
        } catch (err) {
            next(err);
        }
    });

    router.post("/refresh", async (req, res, next) => {
        try {
            const parsed = refreshSessionBodySchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                res.status(400).json({
                    error: "Invalid request body",
                    details: parsed.error.flatten(),
                });
                return;
            }

            const session = await authAdapter.refreshSession(parsed.data.refreshToken);
            if (!session) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("Pragma", "no-cache");
            res.json(session);
        } catch (err) {
            next(err);
        }
    });

    router.get("/me", async (req, res, next) => {
        try {
            const token = parseBearer(req.headers.authorization);
            if (!token) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const user = await authAdapter.verifyAccessToken(token);
            if (!user) {
                res.status(401).json({ error: "Unauthorized" });
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
