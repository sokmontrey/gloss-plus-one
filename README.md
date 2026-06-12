# GlossPlusOne (gloss+1)

<div align="center">
A Chrome browser extension for immersive language learning<br>
Built at Hack Canada 2026 🇨🇦
</div>

Gloss+1 helps you learn a language while browsing the web — highlight text to see translations, hear pronunciations, and test yourself.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- Google Chrome (for loading the unpacked extension)
- A Supabase project with Google OAuth provider enabled
- Supabase CLI (for local development — `supabase start`)

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

For local Supabase development, run `supabase start` first, then use:

```ini
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=your_local_anon_key
```

### Develop & Build

```bash
npm run dev        # Vite dev server (popup)
npm run build      # Production bundle → dist/
npm run typecheck  # Verify TypeScript types
```

### Load the Extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder

### Supabase Migrations

Apply SQL in `supabase/migrations/` to your project (via Supabase SQL editor or CLI) so the `user_profiles` table and signup trigger exist.

---

## 📝 License

MIT — see `LICENSE`.

<div align="center">
Happy Learning! 🌍📚
</div>
