# GlossPlusOne (Gloss+1)

<div align="center">
A Chrome extension for immersive language learning while you browse<br>
Built at Hack Canada 2026 🇨🇦
</div>

> **Project status:** The team is currently on a break. Gloss+1 is **not published on the Chrome Web Store** — you run the full stack yourself. APIs and behavior may change.

---

## What is Gloss+1?

Gloss+1 is named after **i+1** — a language-learning idea from Stephen Krashen's *Input Hypothesis*. **i** is your current level; **+1** is material just slightly above it: challenging enough to grow, but still understandable from context.

Instead of switching an entire page to French (or your target language) and overwhelming you, Gloss+1 **replaces only the words you can most likely figure out from what's around them**. You stay in mostly-English reading flow while French words appear where context makes them recoverable — classic comprehensible input, applied inline on real web pages.

**Example:** On a news article, a highly predictable phrase like *"the red car"* might become *"la voiture rouge"* while harder, content-critical words stay in English until you're ready for them.

---

## How it works

1. **Extract** — The content script finds readable text blocks on the page.
2. **Score recoverability** — A self-hosted MLM service scores each word by how predictable it is from surrounding context.
3. **Select replacements** — High-recoverability words are marked for translation.
4. **Translate** — DeepL or Cerebras translates only those marked spans.
5. **Apply** — The extension swaps selected English spans with your target language inline.

---

## Roadmap

- **Progression tracking** — Remember what you've seen, adjust replacement aggressiveness over time, and build toward a personal word bank. (Next up.)
- **More target languages** — French and others beyond the current English → Brazilian Portuguese default.
- **Smarter per-user thresholds** — Tie recoverability cutoff and known-word filtering to profile/progress data.

---

## Setup

Gloss+1 is self-hosted only. Clone the repo, configure env vars, run the services, build the extension, and load it unpacked in Chrome.

### Prerequisites

Install before you start:

- Node.js 18+ (Node 20+ recommended)
- [Docker](https://docs.docker.com/get-docker/) (for the MLM recoverability service)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Google Chrome (load unpacked — not on the Web Store)
- **Translation API key** — required; get one before running the stack:
  - [DeepL API](https://www.deepl.com/pro-api) (default), or
  - [Cerebras API](https://inference-docs.cerebras.ai/) (set `SB_TRANSLATE_PROVIDER=cerebras`)
- **Google OAuth credentials** — for sign-in ([Google Cloud Console](https://console.cloud.google.com/apis/credentials))

Run `make help` anytime to list available make targets.

### Commands (in order)

#### 1. Clone and install dependencies

```bash
git clone https://github.com/sokmontrey/gloss-plus-one.git
cd gloss-plus-one
npm install
```

#### 2. Create `.env` (edge function + Supabase auth)

Create `.env` in the project root. Fill in your DeepL or Cerebras key, Google OAuth credentials, and Supabase keys (step 3):

```ini
# Supabase — fill in after `make start-db` (step 3)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=

# Google OAuth (local Supabase reads these)
SB_GOOGLE_CLIENT_ID=your_google_client_id
SB_GOOGLE_SECRET=your_google_client_secret

# Translation — pick one provider
SB_TRANSLATE_PROVIDER=deepl
SB_TRANSLATE_DEEPL_API_URL=https://api-free.deepl.com/v2/translate
SB_TRANSLATE_DEEPL_API_KEY=your_deepl_key
SB_TRANSLATE_CEREBRAS_API_KEY=your_cerebras_key

# MLM service (edge function reaches host via Docker bridge on Linux)
SB_RECOVERABILITY_MLM_URL=http://172.17.0.1:8002/recoverable_score
```

#### 3. Start Supabase and copy keys

```bash
make start-db
```

Migrations in `supabase/migrations/` are applied automatically. Copy the output keys into your env files:

```bash
supabase status
```

Create `.env.local` for the extension build:

```ini
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<Publishable key from supabase status>
```

Also paste the **anon** key into `SUPABASE_ANON_KEY` in `.env`.

#### 4. Start the MLM service

In a **second terminal** (leave it running):

```bash
docker compose up mlm-service
```

> Only `mlm-service` is required. The other services in `docker-compose.yml` are not used by the current pipeline.

#### 5. Start edge functions

In a **third terminal** (leave it running):

```bash
make start-functions
```

This runs `supabase functions serve --env-file .env`, which serves the `replacement` pipeline at `http://127.0.0.1:54321/functions/v1/replacement`.

#### 6. Build the extension

In a **fourth terminal** (or after step 5 is up):

```bash
make build-extension
```

#### 7. Load the extension in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. Copy your extension ID from the extensions page
5. Add `https://<EXT_ID>.chromiumapp.org/` to `additional_redirect_urls` in `supabase/config.toml`, then restart Supabase:

```bash
make stop-db && make start-db
```

Also add that same URL as an authorized redirect URI in your Google OAuth client settings.

#### 8. Use it

1. Click the Gloss+1 icon and sign in with Google.
2. Open a website and turn **Extraction** on for that site in the popup.
3. Browse — Gloss+1 scans the page and replaces recoverable English with your target language inline.

Rebuild after code changes:

```bash
make build-extension
```

Then reload the extension in `chrome://extensions/`.

### Quick reference

| Command | What it does |
|---------|--------------|
| `make help` | List all make targets |
| `make start-db` | Start local Supabase (`supabase start`) |
| `make stop-db` | Stop local Supabase |
| `make start-functions` | Serve edge functions with `.env` |
| `make build-extension` | Build extension to `dist/` |
| `make test-functions` | Run edge function tests |
| `npm run dev` | Vite dev server (popup UI only) |
| `npm run typecheck` | TypeScript check |

**Typical dev session** — three terminals:

```bash
# Terminal 1
make start-db

# Terminal 2
docker compose up mlm-service

# Terminal 3
make start-functions
```

Then rebuild/reload the extension as needed with `make build-extension`.

---

## License

MIT — see [LICENSE](LICENSE).

<div align="center">
Happy learning! 🌍📚
</div>
