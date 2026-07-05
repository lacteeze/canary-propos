-- 0013_update_storage_bucket.sql
-- Updates the org-assets bucket to support lease PDFs (Phase 2: LEASE-05).
-- Part 1: Increase file size limit to 20MB and add application/pdf MIME type.
-- Part 2: Add tenant storage SELECT policy scoped to their lease document path.
--
-- Path convention for lease docs: {org_id}/leases/{lease_id}/{filename}
-- storage.foldername(name) is 1-indexed:
--   [1] = org_id
--   [2] = 'leases' (subfolder)
--   [3] = lease_id
--   [4] = filename
--
-- Security: EXISTS subquery verifies the lease at path[3] belongs to the requesting tenant.
-- This is defense-in-depth; the primary gate is leases_select_tenant RLS + server action logic.

-- ============================================================
-- Part 1: Update bucket limits and allowed MIME types
-- ============================================================
UPDATE storage.buckets
SET
  file_size_limit    = 20971520,  -- 20 MB (lease PDFs can be several MB)
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'application/pdf'
  ]
WHERE id = 'org-assets';

-- ============================================================
-- Part 2: Add tenant lease storage SELECT policy
-- ============================================================
CREATE POLICY "storage_select_tenant_lease"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (SELECT public.user_role()) = 'tenant'
  AND (storage.foldername(name))[2] = 'leases'
  AND EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.id::text = (storage.foldername(name))[3]
      AND l.tenant_id = (SELECT public.person_id())
      AND l.org_id = (SELECT public.org_id())
  )
);
