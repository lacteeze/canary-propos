-- Migration: 20260624000002_alter_people_last_seen
-- Purpose: Add last_seen_announcements_at to people for unread announcement badge

ALTER TABLE people ADD COLUMN IF NOT EXISTS last_seen_announcements_at TIMESTAMPTZ;

-- No new RLS policy needed: the existing "people_update_self" policy (0005_rls_people.sql)
-- already allows tenants/owners/vendors to UPDATE their own people row.
-- The Server Action that calls this column MUST only ever SET last_seen_announcements_at
-- and no other fields. RLS cannot restrict individual columns in Postgres.
