# GlossPlusOne (Gloss+1)

<div align="center">
A language learning platform built around comprehensible input (i+1)<br>
Post-hackathon codebase: MVP for VC pitch + core backend groundwork<br>
</div>

## Overview

Gloss+1 helps learners stay in **meaningful target-language input** just above their current level—the **i+1 hypothesis** (Krashen): input should be mostly understood, with a small stretch toward what comes next. The product goal is to **introduce functional language early**, build durable toolsets (patterns, vocabulary, pragmatics), and **personalize** what the learner sees so they rarely need to drop back to a fully comfortable language.

This branch is a **rebuild focused on**:

1. **Core backend** — user identity, profiles, and (next) progress and personalization data in Postgres (Supabase).
2. **Chrome extension** — first client surface: auth, then learning UI wired to that backend.

Future clients (dedicated app, YouTube integration, mobile) are expected to use the **same** user and progress APIs.

## Name

- **Gloss** — the idea of lightly supporting understanding without breaking immersion.
- **+1** — i+1: the next small step of comprehensible challenge.

## Hackathon build vs. this repo

The **Hack Canada 2026** demo added rich on-page features (LLM-backed glosses, TTS, assessment flows, third-party learning memory). That work validated UX and narrative; **this repository is intentionally slimmer** while the data model and server-side personalization are designed.

| Area | Hackathon direction (reference) | Current repo |
|------|-----------------------------------|--------------|
| Auth | Varies by prototype | Google OAuth via Supabase; session in `chrome.storage` |
| Data | Client-heavy | Supabase Auth + `public.user_profiles`; migrations in `supabase/migrations/` |
| Extension UI | Full overlay | Popup sign-in/out; content script mounts shadow host only (overlay UI not wired) |
| LLMs / TTS / external assistants | Integrated in demo | Not in dependencies; add when the personalization layer needs them |

## Tech stack

- **Extension client**: React 19, TypeScript, Vite, `@crxjs/vite-plugin` (Manifest V3), Tailwind CSS v4
- **Backend (current)**: [Supabase](https://supabase.com/) — Auth + PostgreSQL
- **Roadmap**: Row Level Security policies for all profile access patterns, Edge Functions or API routes for aggregation and recommendation logic, concept/progress tables keyed by `user_id`

## User model (today)

On **Google sign-up**, a trigger creates a row in `public.user_profiles`:

- `user_id` (PK, FK to `auth.users`)
- `email`, optional `name`, `avatar_url`
- `target_language` — nullable until onboarding collects it
- `proficiency_level` — defaults to `0`
- `onboarding_complete` — defaults to `false`

See `supabase/migrations/` for the exact schema and trigger.

## Getting started

### Prerequisites

- Node.js 18+ (repo uses modern tooling; Node 20+ recommended)
- Chrome (Chromium) for loading the unpacked extension
- A Supabase project with Google provider enabled

### Install

```bash
git clone https://github.com/sokmontrey/gloss-plus-one.git
cd gloss-plus-one
npm install
```

### Environment

Create `.env.local` in the project root:

```ini
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_public_key
```

The extension reads these at build time (`import.meta.env`).

### Develop and build

```bash
npm run dev      # Vite dev server (popup)
npm run build    # Production bundle → dist/
npm run typecheck
```

### Load the extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder after `npm run build`

### Supabase migrations

Apply SQL in `supabase/migrations/` to your project (Supabase SQL editor or CLI) so `user_profiles` and the signup trigger exist and match the client.

## Roadmap (pitch MVP)

- **Profiles**: Read/update own profile from the extension after RLS policies cover `SELECT` / `UPDATE` for authenticated users (today only an insert policy is defined; extend before onboarding UI).
- **Progress model**: Tables for concepts, user mastery, and learning events; APIs to drive i+1 decisions.
- **Extension**: Onboarding (target language, level), then contextual help UI backed by the progress service.
- **Long term**: Additional surfaces sharing the same backend.

## Contributing

Fork, branch, PR. See `context.md` for a concise map of the codebase.

## License

MIT — see `LICENSE`.

## Acknowledgments

Built at **Hack Canada 2026** (Second Place Overall; SPUR Founder Track recognitions). [Devpost submission](https://devpost.com/software/glossplusone).

<div align="center">
Happy learning — one comprehensible step at a time.
</div>
