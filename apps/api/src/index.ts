import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import { createSupabaseAuthAdapter } from "./adapters/supabase-auth.js";
import { createSignInService } from "./features/auth/sign-in.js";
import { createUserProfileRepository } from "./features/user-profile/repository.js";
import { createUserProfileService } from "./features/user-profile/service.js";
import { createSupabaseUserClient } from "./lib/supabase-user.js";
import { createRoutes } from "./routes.js";
import { createEnv } from "./env.js";
import { logger, requestLogger, type RequestWithLogger } from "./logger.js";

const env = createEnv();

const authAdapter = createSupabaseAuthAdapter({
    url: env.SUPABASE_URL,
    publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey: env.SUPABASE_SECRET_KEY,
});
function userProfileServiceForAccessToken(accessToken: string) {
    return createUserProfileService({
        userProfileRepository: createUserProfileRepository({
            supabaseClient: createSupabaseUserClient({
                url: env.SUPABASE_URL,
                publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
                accessToken,
            }),
        }),
    });
}

const signInService = createSignInService({
    authAdapter,
    ensureProfileAfterSignIn: async (user, accessToken) => {
        await userProfileServiceForAccessToken(accessToken).ensureProfileAfterSignIn(user);
    },
});

const app = express();

app.set("trust proxy", 1);

app.use(requestLogger);

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith("/api/auth"),
});

app.use("/api/auth", authLimiter);
app.use(generalLimiter);

app.use(
    cors({
        origin:
            env.CORS_ORIGINS.length > 0
                ? env.CORS_ORIGINS
                : false,
        credentials: true,
    }),
);

app.use(cookieParser());

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use(
    "/api",
    createRoutes({
        authAdapter,
        signInService,
        userProfileServiceForAccessToken,
        oauthRoutesConfig: {
            googleOAuthRedirectTo: env.GOOGLE_OAUTH_REDIRECT_TO,
            googleOAuthCallbackUrl: env.GOOGLE_OAUTH_CALLBACK_URL,
        },
    }),
);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    (req as RequestWithLogger).log?.error({ err }, "Unhandled request error");
    logger.error({ err }, "Unhandled application error");
    res.status(500).json({ error: "internal server error" });
});

app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "API listening");
});
