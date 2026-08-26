<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Canary PropOS is a single Next.js 16 (App Router, Turbopack) property-management SaaS backed by **Supabase** (Postgres + Auth + Storage). There is one product/service: the Next.js app (`http://localhost:3000`), which requires a Supabase instance. Docker and the Supabase CLI are pre-installed in the environment snapshot; the startup update script only runs `npm install`.

### Start the dev environment (every session)
Docker and the local Supabase stack do not survive a fresh VM boot, so start them each session:
1. `bash scripts/dev-local-db.sh` — starts Docker + a local Supabase stack, applies migrations, fixes grants, and writes `.env.local`. Idempotent; safe to re-run.
2. `npm run dev` — app on `http://localhost:3000`. Local sign-up is at `/signup` (email confirmation is disabled locally, so signup logs you straight in → onboarding → dashboard).

### Non-obvious gotchas
- **Do NOT run a bare `supabase start`.** The files in `supabase/migrations` mix `00xx_` and `2026........._` prefixes, so lexicographic apply order runs `..._create_work_orders.sql` *after* `0034_extend_work_orders...` (which depends on it) and fails. `scripts/dev-local-db.sh` works around this by applying migrations in git-commit order without renaming the committed files (renaming would corrupt migration-version tracking vs. the hosted project). If you add a migration, keep the helper in mind.
- **Auth hook + grants** are set up by `supabase/config.toml` (`[auth.hook.custom_access_token]` enabled) and the helper's grant/revoke step. Without them, all authenticated queries return 0 rows.
- **Running unit/integration tests:** vitest reads `process.env`, so load the env first: `set -a; . ./.env.local; set +a; npx vitest run`. The RLS/integration suites self-seed orgs/users via the service-role client and clean up after themselves.
- **Known pre-existing test failure (not an environment issue):** `tests/helpers/seed.ts` inserts `role: <string>` but migration `0012` changed `people.role` to `TEXT[]`, so 9 RLS/orgs test files fail with `malformed array literal`. The other ~169 tests pass. (Fix would be `role: [opts.role]`.)
- **Properties only appear in the UI once they have at least one unit** — the app loads properties by joining through `units` (`src/lib/canary/load-db.ts`). A freshly created property persists but is hidden in the list/dashboard until a unit exists. Also, `createProperty` calls `revalidatePath('/properties')` while the list renders at `/app?view=properties`, so a manual reload may be needed to see changes.
- No lint script is defined and there are no Playwright specs yet (`playwright.config.ts` points at `tests/e2e`, which is empty).
