-- 0006_storage_buckets.sql
-- Creates the org-assets storage bucket and RLS policies for storage.objects.
-- Path convention: org-assets/{org_id}/{filename}
-- First path segment is the org_id — enforced via storage.foldername() (FOUND-13, ORGS-04).
-- All helper calls wrapped in (SELECT ...) per Pitfall 2.

-- ============================================================
-- Create bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-assets',
  'org-assets',
  false,                        -- private bucket — all access via signed URLs
  5242880,                      -- 5 MB file size limit (logo uploads)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Storage RLS policies
-- Objects must be under /{org_id}/ as the first path segment.
-- storage.foldername(name)[1] extracts the first directory segment.
-- ============================================================

-- SELECT: managers, employees, admins can read objects in their org's folder
CREATE POLICY "storage_select_staff"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- INSERT: managers and admins can upload to their org's folder
CREATE POLICY "storage_insert_manager_admin"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- UPDATE: managers and admins can replace objects in their org's folder
CREATE POLICY "storage_update_manager_admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (SELECT public.user_role()) IN ('manager', 'admin')
)
WITH CHECK (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- DELETE: managers and admins can delete objects in their org's folder
CREATE POLICY "storage_delete_manager_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);
