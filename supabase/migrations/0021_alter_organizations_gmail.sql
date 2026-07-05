-- 0021_alter_organizations_gmail.sql
-- Phase 4: Add Gmail OAuth token storage columns to organizations
-- All columns nullable — Gmail connection is optional per organization
-- gmail_token_expiry stored as bigint (unix epoch milliseconds) per research doc

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS gmail_access_token   text,
  ADD COLUMN IF NOT EXISTS gmail_refresh_token  text,
  ADD COLUMN IF NOT EXISTS gmail_token_expiry   bigint,
  ADD COLUMN IF NOT EXISTS gmail_connected_at   timestamptz;
