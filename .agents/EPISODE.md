## Auth backend (2025-03-25)

- **Parallel work:** Subagent owned `@gpo/shared` auth contracts (`IAuthService`, token/user types) so server work could proceed against a stable API; server `package.json` / install stayed in the main session to avoid lockfile races.
- **OAuth `redirectTo`:** Supabase expects an allow-listed callback URL, not the post-login SPA URL. Routes build `/api/auth/callback` on the current request host and put the client `redirect_to` in query; `getOAuthUrl` still forwards that single URL to `signInWithOAuth` as specified.
- **Open redirects:** `redirectTo` / `redirect_to` must match an origin in `CORS_ORIGINS`; default post-login is the first origin in that list.
- **Logout vs spec:** `GoTrueAdminApi.signOut` takes a JWT and optional scope, not a user id. `revokeAllSessions(accessToken)` wraps `signOut(jwt, 'global')` so all refresh tokens for the user are invalidated while staying behind the service.
- **`SUPABASE_JWT_SECRET`:** Required and loaded for the single-env contract; verification uses `getUser(jwt)` (revocation-aware) instead of local JWT crypto.
- **Cookie:** Refresh token in `gpo_refresh`, HTTP-only, `SameSite=Lax`, `Secure` only when `NODE_ENV=production`.
