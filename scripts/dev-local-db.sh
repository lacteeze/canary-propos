#!/usr/bin/env bash
#
# dev-local-db.sh — bring up a local Supabase stack for development.
#
# Idempotent: safe to re-run. It will:
#   1. Ensure the Docker daemon is running.
#   2. Start the local Supabase stack (Postgres + Auth + Storage + Studio).
#   3. Apply the repo's SQL migrations IN GIT-CHRONOLOGICAL ORDER (only when the
#      schema is not already present).
#   4. Fix public-schema grants for anon/authenticated/service_role and re-apply
#      the migrations' targeted REVOKEs.
#   5. Create .env.local (pointing at the local stack) if it does not exist.
#
# It does NOT start the Next.js dev server (run `npm run dev` yourself) and it
# does NOT modify the committed migration files.
#
# WHY THE CUSTOM ORDERING: the files in supabase/migrations mix two prefix
# schemes (`00xx_...` and `2026........._...`). `supabase start` applies them in
# lexicographic order, which runs `20260623000000_create_work_orders.sql` AFTER
# `0034_extend_work_orders_csv_fields.sql` even though 0034 depends on it — so a
# plain `supabase start` fails. Renaming the committed files is unsafe (it would
# change their migration version identifiers vs. the hosted project), so instead
# we start Supabase with migrations temporarily stashed and apply them ourselves
# in the order they were actually committed.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MIG_DIR="supabase/migrations"

log() { echo "[dev-local-db] $*"; }

# --- 1. Docker daemon ---------------------------------------------------------
if ! sudo docker info >/dev/null 2>&1; then
  log "starting dockerd..."
  sudo bash -c 'nohup dockerd >/tmp/dockerd.log 2>&1 &'
  for _ in $(seq 1 30); do sudo docker info >/dev/null 2>&1 && break; sleep 1; done
fi
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true

# --- 2. Compute git-chronological migration order (before any stashing) -------
ORDER_FILE="$(mktemp)"
for f in "$MIG_DIR"/*.sql; do
  ad="$(git log --diff-filter=A --format='%at' -1 -- "$f" 2>/dev/null || true)"
  [ -z "$ad" ] && ad=9999999999   # not-yet-committed files apply last
  echo "$ad $(basename "$f")"
done | sort -n -k1,1 -k2,2 | awk '{print $2}' > "$ORDER_FILE"

# --- 3. Start Supabase without letting it auto-apply migrations ---------------
STASH="$(mktemp -d)"
restore_migrations() { mv "$STASH"/*.sql "$MIG_DIR"/ 2>/dev/null || true; rmdir "$STASH" 2>/dev/null || true; }
trap restore_migrations EXIT
mv "$MIG_DIR"/*.sql "$STASH"/ 2>/dev/null || true

log "starting supabase (idempotent)..."
supabase start >/dev/null

DB_CONTAINER="$(sudo docker ps --format '{{.Names}}' | grep -m1 'supabase_db' || true)"
[ -z "$DB_CONTAINER" ] && { log "ERROR: supabase db container not found"; exit 1; }
PG_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres"
psql_db() { sudo docker exec -i "$DB_CONTAINER" psql "$PG_URL" "$@"; }

# --- 4. Apply migrations + grants (only if schema is missing) -----------------
if psql_db -tAc "select to_regclass('public.organizations')" | grep -q organizations; then
  log "schema already present — skipping migration apply."
else
  log "applying $(wc -l < "$ORDER_FILE") migrations in git-chronological order..."
  while read -r m; do
    [ -z "$m" ] && continue
    psql_db -v ON_ERROR_STOP=1 -q < "$STASH/$m"
  done < "$ORDER_FILE"

  log "granting public-schema privileges to supabase roles..."
  psql_db -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
SQL

  log "re-applying targeted REVOKEs from migrations..."
  psql_db -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
REVOKE ALL ON FUNCTION public.public_property_lease_end(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_property_is_leased(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_property_id_for_slug(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_property_id_for_listing(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_assigned_property_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_active_unit_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_active_property_ids() FROM PUBLIC, anon;
SQL
fi

# --- 5. .env.local (local Supabase demo keys are universal constants) ---------
if [ ! -f .env.local ]; then
  log "writing .env.local for the local stack..."
  cat > .env.local <<'ENV'
# Local development against the local Supabase stack (see scripts/dev-local-db.sh).
# The anon/service_role keys below are the standard, non-secret Supabase local
# demo JWTs (identical on every local install). Do NOT commit (gitignored).
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Per-role test users for the integration tests (created on demand by the tests).
TEST_MANAGER_EMAIL=test-manager@example.com
TEST_MANAGER_PASSWORD=test-password-123
TEST_TENANT_EMAIL=test-tenant@example.com
TEST_TENANT_PASSWORD=test-password-123
TEST_OWNER_EMAIL=test-owner@example.com
TEST_OWNER_PASSWORD=test-password-123
TEST_VENDOR_EMAIL=test-vendor@example.com
TEST_VENDOR_PASSWORD=test-password-123
TEST_ADMIN_EMAIL=test-admin@example.com
TEST_ADMIN_PASSWORD=test-password-123

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_ORG_SLUG=canary
ENV
fi

log "done. Supabase API http://127.0.0.1:54321 | Studio http://127.0.0.1:54323"
log "next: 'npm run dev' (app on http://localhost:3000)"
