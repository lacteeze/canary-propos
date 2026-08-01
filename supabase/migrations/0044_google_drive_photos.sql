-- 0044_google_drive_photos.sql
-- Org-level Google Drive OAuth tokens + per-property linked folder + drive_file_id on media.

-- Organizations: Drive OAuth (mirror Gmail columns)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS drive_access_token   text,
  ADD COLUMN IF NOT EXISTS drive_refresh_token  text,
  ADD COLUMN IF NOT EXISTS drive_token_expiry   bigint,
  ADD COLUMN IF NOT EXISTS drive_connected_at   timestamptz;

COMMENT ON COLUMN public.organizations.drive_access_token IS
  'Google Drive OAuth access token (server-only; never expose to client).';
COMMENT ON COLUMN public.organizations.drive_refresh_token IS
  'Google Drive OAuth refresh token (server-only).';
COMMENT ON COLUMN public.organizations.drive_token_expiry IS
  'Unix epoch milliseconds when drive_access_token expires.';
COMMENT ON COLUMN public.organizations.drive_connected_at IS
  'When Drive was last successfully connected for this org.';

-- Properties: optional linked Drive folder for photo sync
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS drive_folder_id       text,
  ADD COLUMN IF NOT EXISTS drive_folder_name     text,
  ADD COLUMN IF NOT EXISTS drive_last_synced_at  timestamptz;

COMMENT ON COLUMN public.properties.drive_folder_id IS
  'Google Drive folder ID linked for non-recursive photo sync.';
COMMENT ON COLUMN public.properties.drive_folder_name IS
  'Display name of the linked Drive folder.';
COMMENT ON COLUMN public.properties.drive_last_synced_at IS
  'When linked-folder photo sync last completed successfully.';

-- Property media: track Drive source file for upsert/replace without duplicates
ALTER TABLE public.property_media
  ADD COLUMN IF NOT EXISTS drive_file_id text;

COMMENT ON COLUMN public.property_media.drive_file_id IS
  'Google Drive file ID when this media was imported/synced from Drive.';

-- Unique per org when set (allows multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS property_media_org_drive_file_id_uidx
  ON public.property_media (org_id, drive_file_id)
  WHERE drive_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS properties_drive_folder_id_idx
  ON public.properties (org_id)
  WHERE drive_folder_id IS NOT NULL;
