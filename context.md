# Code context: Gloss+1

Living notes for agents and contributors. **Product:** post-hackathon MVP aimed at a VC pitch—personalized i+1 language learning with Supabase-backed identity and progress, Chrome extension as the first client.

## Product framing (pitch)

- **Thesis:** Keep learners in target-language input that is mostly understandable plus a small stretch (i+1); personalize exposure so they build functional toolsets without constantly reverting to a comfortable language.
- **Durable asset:** Per-user learner state and policy (what to show next, how much scaffolding), not only the extension UI.
- **Current implementation focus:** Auth + `user_profiles`; extension shell. Concept graph, events, and recommendation logic are **not** implemented yet—plan in README roadmap.

## Repository map

### Extension

| File | Role |
|------|------|
| `manifest.config.ts` | MV3 manifest: popup, service worker (`src/background.ts`), content script `src/content.tsx`; permissions `storage`, `identity`, broad `host_permissions` |
| `src/popup.tsx` | Popup entry; mounts `App` |
| `src/content.tsx` | Injects fixed-position host + shadow root + stylesheet link; **does not render React yet** (overlay placeholder) |
| `src/background.ts` | Service worker (minimal / placeholder) |
| `src/App.tsx` | Popup UI: Supabase env check, loading, Google sign-in or email + sign out; `variant` supports future `content` styling |
| `src/lib/supabase.ts` | `createClient` with **custom storage**: `chrome.storage.local`, key `gloss-plus-one.auth` (session survives popup close; shared with service worker context) |
| `src/lib/auth.ts` | `signInWithGoogle`: OAuth URL with PKCE, `chrome.identity.launchWebAuthFlow`, then `exchangeCodeForSession` or `setSession` from hash tokens; `signOut` |
| `src/hooks/useAuth.ts` | `getSession` + `onAuthStateChange` subscription |
| `src/components/GoogleSignInButton.tsx` | Calls `signInWithGoogle` |
| `src/components/badge.tsx`, `spinner.tsx`, `components/ui/button.tsx` | UI primitives (CVA, Tailwind) |

### Build

| File | Role |
|------|------|
| `vite.config.ts` | Vite + React + `@crxjs/vite-plugin` |
| `package.json` | Scripts: `dev`, `build`, `typecheck`, `ext:redirect-url`; **no** LLM/TTS client deps in this MVP |

### Database (Supabase)

| Migration | Role |
|-----------|------|
| `supabase/migrations/20260403120000_create_user_profiles.sql` | `user_profiles`: `user_id`, `email`, `name`, `avatar_url`, `target_language` (nullable), `proficiency_level` default 0, `onboarding_complete` default false, timestamps |
| `supabase/migrations/20260403130000_user_profiles_rls.sql` | RLS enabled; **`user_profiles_insert_own`** only — authenticated users may `INSERT` own row |
| `supabase/migrations/20260403140000_user_profiles_on_auth_signup.sql` | `handle_new_user()` `SECURITY DEFINER` + trigger `on_auth_user_created` on `auth.users` → upsert profile from Google metadata |

**Gap for onboarding:** Clients will need **`SELECT` and `UPDATE`** policies (and possibly `service_role`-only backfills) so the extension can read and set `target_language`, `proficiency_level`, and `onboarding_complete`. Add migrations before shipping profile editing.

## Key patterns (code)

### OAuth in an extension

```typescript
// Redirect URL Chrome intercepts after consent
const REDIRECT_URL = `https://${chrome.runtime.id}.chromiumapp.org/`

await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
})
const responseUrl = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true })
// Then exchangeCodeForSession(code) or setSession from hash tokens — see src/lib/auth.ts
```

### Session storage adapter

Custom `auth.storage` in `getSupabase()` (`src/lib/supabase.ts`) maps Supabase session persistence to `chrome.storage.local` so popups and workers see one session.

### Shadow DOM host (content script)

`src/content.tsx` creates `#gloss-plus-one-root`, `attachShadow({ mode: 'open' })`, injects bundled CSS via `?url` and `chrome.runtime.getURL`. React render is commented until overlay work exists.

## Architecture sketch

```
Popup (App + useAuth)
        │
        ▼
  Supabase JS client  ──► Auth API + PostgREST (when RLS allows)
        │
  chrome.storage.local (session)
        ▲
Content script / future overlay (same client pattern)
```

## Environment

Required for the extension build:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon / publishable key)

## Status checklist

- Done: Google sign-in, session persistence, profile row on signup (server-side trigger).
- Done: Popup auth UX, typecheck pipeline, MV3 bundle.
- Not done: Content overlay React mount, profile read/update from client, progress/personalization tables, server-side recommendation API.
- README vs code: README now describes this MVP; older hackathon feature list lives only as directional roadmap in README.

## Suggested next implementation priorities

1. **RLS** — Policies for users to `SELECT` / `UPDATE` their own `user_profiles` row (and any future per-user tables).
2. **Onboarding UI** — Set `target_language`, `proficiency_level`, `onboarding_complete` from the popup once RLS allows.
3. **Progress schema** — `concepts` (or curriculum nodes), `user_concept_state`, append-friendly `learning_events` keyed by `user_id`.
4. **Personalization entrypoint** — Edge Function or small API that consumes events + state and returns “next-step” hints for the extension (later: other clients).
5. **Content script** — Uncomment / implement `App variant="content"` (or dedicated overlay) and wire to (4).
