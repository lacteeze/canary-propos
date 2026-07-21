# Mac local setup — Canary PropOS

Run the Next.js app on a Mac with a local `.env.local`. Vercel environment variables apply to deployments only; they do **not** sync to a new machine. Supabase hosts the database and auth, but the app still needs the project URL and keys locally.

`.env*` files are gitignored except `.env.example`. **Never commit `.env.local`.**

## Prerequisites

- macOS with Git
- Node.js 20+ (`node -v`)
- Optional: [Vercel CLI](https://vercel.com/docs/cli) if you want to pull env vars from the linked project

## Steps

```bash
git clone <repo-url> canary-propos
cd canary-propos
node -v   # Node 20+ recommended
npm install
cp .env.example .env.local
# Fill in values (see below), or pull from Vercel:
# vercel link   # once, if not already linked
# vercel env pull .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Easiest env setup

If you have access to the Vercel project:

```bash
vercel link
vercel env pull .env.local
```

That copies deploy env vars into `.env.local` so you do not have to paste keys by hand. Review the file afterward and remove anything you do not need locally.

## Environment variables

Values come from `.env.example`. Use placeholders only — never put real secrets in this guide or in git.

### Minimum (app boots / auth against Supabase)

| Variable | Where to get it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key |

### Strongly recommended

| Variable | Notes |
|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → `service_role` key. **Server only** — never prefix with `NEXT_PUBLIC_`. |

### Optional (feature-dependent)

| Variable | Used for |
|----------|----------|
| `PINGRAM_API_KEY` | All transactional email + SMS (Canadian region). Allow types in `src/lib/email/pingram-types.ts` |
| `HOSPITABLE_API_PAT` | Hospitable Public API |
| `NEXT_PUBLIC_APP_URL` | Public URL in email links (defaults differ in prod) |
| `NEXT_PUBLIC_DEFAULT_ORG_SLUG` | Marketing landing org slug |
| `LISTING_ALERT_NOTIFY_EMAIL` | Override company notify address for “Notify me” |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REDIRECT_URI` | Gmail OAuth for inbox sync + Interac matching |
| `ANTHROPIC_API_KEY` | Ask Canary + Gmail AI classification |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI (non-interactive `db push`) |
| `SUPABASE_DB_PASSWORD` | Direct database connection |
| `TEST_*_EMAIL` / `TEST_*_PASSWORD` | Integration test users (create in Supabase Auth first) |

See `.env.example` for the full list and comments.

## Quick checks

- After `npm run dev`, the terminal should show the local URL with no missing-env crash.
- Sign-in / Supabase calls fail with clear auth errors if URL or anon key are wrong — recheck those two first.
- If `vercel env pull` fails, fall back to copying from `.env.example` and pasting from the Supabase dashboard (and other dashboards as needed).
