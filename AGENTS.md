# AGENTS.md — GlossPlusOne

## What this project is

GlossPlusOne is a browser extension that teaches languages through inline immersion. It replaces words on web pages the user is already reading with target language equivalents, following Krashen's i+1 hypothesis. The user learns by inferring meaning from context, not by studying flashcards.

The product has two learning phases:
- **Phase 1 (functional scaffold):** Replace L1 function words (prepositions, articles, conjunctions) with L2 equivalents. Small closed set, high repetition, near-zero ambiguity. Entirely client-side via static lookup tables.
- **Phase 2 (content through structure):** Replace content words (nouns, adjectives, verbs) using a concept bank. The L2 function words the user already acquired become context clues for new content words. Uses POS tagging, sense disambiguation, and LLM fallback for ambiguous cases.

## Architecture

Monorepo using pnpm workspaces + Turborepo.

```
gloss-plus-one/
├── packages/
│   ├── shared/      → @gpo/shared   — types, interfaces, constants
│   ├── server/      → @gpo/server   — Express API (auth, progress, LLM proxy)
│   ├── dashboard/   → @gpo/dashboard — React SPA (progress viz, settings)
│   └── extension/   → @gpo/extension — Chrome MV3 extension
└── supabase/        → migrations, config, seed data
```

### Key architectural rules

1. **Interface contracts live in `@gpo/shared`.** Every service in the server implements an interface from shared. Extension and dashboard import types from shared. No package imports another package's internals.

2. **Clients never talk to Supabase directly.** The extension and dashboard only talk to the Express server. The server proxies all Supabase interactions. This means auth, database queries, and LLM calls all go through the server.

3. **Each service has one interface file and one "dumb" implementation.** The implementation is the minimum viable version for the demo. The interface is designed for the full product. Swapping implementations later doesn't touch anything outside that service.

4. **No direct `process.env` reads outside `config/env.ts`.** All env vars are loaded and validated in one place.

## Tech stack

| Layer | Tech |
|---|---|
| Server | Express, TypeScript (strict, ESM), tsx for dev |
| Auth | Supabase Auth (Google OAuth), JWT access tokens, HTTP-only refresh token cookies |
| Database | Supabase Postgres (local via CLI + Docker) |
| Cache | Upstash Redis (Phase 2, not yet integrated) |
| LLM | Gemini 2.0 Flash primary, Groq fallback (Phase 2, dormant) |
| Dashboard | React + Vite + TypeScript (minimal for now) |
| Extension | Chrome MV3, React, Vite + @crxjs/vite-plugin, Tailwind |
| Build | pnpm workspaces, Turborepo |

## Server architecture

Layered, feature-split structure:

```
packages/server/src/
├── config/
│   ├── env.ts          → loads and validates all env vars
│   └── supabase.ts     → admin client + per-request user client factory
├── middleware/
│   ├── auth.ts         → JWT verification via supabase.auth.getUser()
│   └── rateLimit.ts    → general (100/min) + strict auth (10/min) limiters
├── services/
│   └── auth.service.ts → implements IAuthService, proxies to Supabase Auth
├── routes/
│   └── auth.ts         → /api/auth/* endpoints
└── index.ts            → Express app wiring, CORS, middleware, mount routes
```

### Auth flow

```
Browser → GET /api/auth/google → redirects to Google consent screen
Google  → GET /api/auth/callback?code=xxx → server exchanges code via Supabase
        → sets refresh_token as HTTP-only secure same-site cookie
        → returns { access_token, user } in response body

Extension/Dashboard → sends access_token in Authorization: Bearer header
                    → when expired, calls POST /api/auth/refresh
                    → server reads refresh_token from cookie
                    → calls Supabase refreshSession
                    → sets new refresh_token cookie, returns new access_token
```

The Postgres trigger `on_auth_user_created` auto-creates a `public.users` row when someone signs up through Supabase Auth, pulling display name from Google's metadata.

### Token strategy

- **Access token:** Short-lived JWT (1 hour default from Supabase). Sent in Authorization header by clients. Verified server-side via `supabase.auth.getUser(token)` which also checks revocation.
- **Refresh token:** Long-lived (7 days). Stored in HTTP-only, secure, same-site cookie. Never exposed to client JS. Rotated on every refresh call (old one invalidated).

## Database

Supabase Postgres with migrations in `supabase/migrations/`.

### Current tables

**`public.users`** — extends `auth.users` with app-specific data:
- `id` (uuid, FK to auth.users, cascade delete)
- `email`, `display_name`
- `target_language` (default 'es')
- `current_phase` (1 or 2)
- `settings` (jsonb: replacement_density, visual_cue_level)
- `created_at`, `updated_at` (auto-managed)
- RLS enabled: users can only read/update their own row

**`public.user_vocab`** — word/concept tracking (exists in migration, Phase 2):
- `user_id`, `word`, `target_lang`, `band`, `status`, `exposure_count`, `last_seen`, `next_review`

### Local development

```bash
npx supabase start        # spins up local Postgres + Auth + Studio
npx supabase db reset      # reapply all migrations from scratch
npx supabase db diff -f x  # capture dashboard changes as migration
```

Google OAuth locally: configured in `supabase/config.toml` under `[auth.external.google]` with env var substitution for client ID and secret.

## Conventions

### TypeScript
- Strict mode, ESM (`"type": "module"` in package.json)
- Use `.js` extensions in relative imports (required for ESM with tsc)
- Prefer `type` imports: `import type { X } from "y"`
- No `any`. Use `unknown` and narrow.

### Express
- Route handlers should not contain business logic. They parse the request, call a service method, and format the response.
- Services implement interfaces from `@gpo/shared`.
- Middleware handles cross-cutting concerns only (auth, rate limiting, error handling).
- Return consistent error shape: `{ error: string }` with appropriate HTTP status.

### Naming
- Files: kebab-case (`auth.service.ts`, `rate-limit.ts`)
- Types/Interfaces: PascalCase, interfaces prefixed with `I` (`IAuthService`)
- Package names: `@gpo/shared`, `@gpo/server`, etc.

### Git
- Branch: `rework-mvp`
- Migrations: timestamped (`YYYYMMDDHHMMSS_description.sql`)
- `.env` is gitignored. `.env.example` documents required vars.

## What is NOT in scope for the demo

- Email/password auth (Google OAuth only)
- Profile pictures, admin roles, team management
- LLM integration (Phase 2)
- Spaced repetition in progression (just exposure counters)
- Redis caching
- WebSocket push for settings sync (extension re-fetches on page load)
- Production deployment config