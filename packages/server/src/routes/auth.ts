import { Router, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { createAuthStrictRateLimiter } from "../middleware/rate-limit.js";
import { authService } from "../services/auth.service.js";

const REFRESH_COOKIE = "gpo_refresh";
const REFRESH_MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000;

function isAllowedRedirect(target: string, origins: readonly string[]): boolean {
  let u: URL;
  try {
    u = new URL(target);
  } catch {
    return false;
  }
  return origins.some((o) => {
    try {
      return u.origin === new URL(o).origin;
    } catch {
      return false;
    }
  });
}

function publicBaseUrl(req: Request): string {
  return `${req.protocol}://${req.get("host") ?? "localhost"}`;
}

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    path: "/",
    sameSite: "lax",
    secure: env.nodeEnv === "production",
  });
}

export function createAuthRouter() {
  const authRouter = Router();
  authRouter.use(createAuthStrictRateLimiter());

  authRouter.get("/google", async (req, res) => {
    try {
      const fallback = env.corsOrigins[0];
      if (!fallback) {
        res.status(500).json({ error: "Server misconfiguration" });
        return;
      }
      const raw = typeof req.query.redirectTo === "string" ? req.query.redirectTo : null;
      const target = raw && isAllowedRedirect(raw, env.corsOrigins) ? raw : fallback;
      const cb = new URL("/api/auth/callback", publicBaseUrl(req));
      cb.searchParams.set("redirect_to", target);
      const url = await authService.getOAuthUrl(cb.toString());
      res.redirect(302, url);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "OAuth failed" });
    }
  });

  authRouter.get("/callback", async (req, res) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : null;
      const redirectTo = typeof req.query.redirect_to === "string" ? req.query.redirect_to : null;
      if (!code || !redirectTo || !isAllowedRedirect(redirectTo, env.corsOrigins)) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }
      const { tokens } = await authService.exchangeCode(code);
      setRefreshCookie(res, tokens.refreshToken);
      const dest = new URL(redirectTo);
      dest.hash = `access_token=${encodeURIComponent(tokens.accessToken)}&expires_in=${tokens.expiresIn}`;
      res.redirect(302, dest.toString());
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Exchange failed" });
    }
  });

  authRouter.post("/refresh", async (req, res) => {
    const rt = req.cookies[REFRESH_COOKIE];
    if (typeof rt !== "string" || !rt) {
      res.status(401).json({ error: "No refresh session" });
      return;
    }
    try {
      const tokens = await authService.refreshSession(rt);
      setRefreshCookie(res, tokens.refreshToken);
      res.json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn });
    } catch {
      clearRefreshCookie(res);
      res.status(401).json({ error: "Invalid refresh token" });
    }
  });

  authRouter.get("/me", requireAuth, async (req, res) => {
    const user = await authService.getUserProfile(req.userId!);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  });

  authRouter.post("/logout", requireAuth, async (req, res) => {
    try {
      clearRefreshCookie(res);
      await authService.revokeAllSessions(req.accessToken!);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Logout failed" });
    }
  });

  return authRouter;
}
