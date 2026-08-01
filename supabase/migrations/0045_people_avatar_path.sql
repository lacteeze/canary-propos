-- 0045_people_avatar_path.sql
-- Profile photos for people (corner avatar in CanaryApp).
-- Path convention: {org_id}/people/{person_id}/avatar/{filename}

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS avatar_path text;

COMMENT ON COLUMN public.people.avatar_path IS
  'Supabase Storage path in org-assets for the person profile photo';

-- Authenticated users can read avatars under their org's people/*/avatar/ tree
-- (staff already have broader SELECT; this covers self + peer avatars for portals).
CREATE POLICY "storage_select_org_avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (storage.foldername(name))[2] = 'people'
  AND (storage.foldername(name))[4] = 'avatar'
);

-- Any authenticated org member can upload/replace/delete their own avatar folder.
CREATE POLICY "storage_insert_self_avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (storage.foldername(name))[2] = 'people'
  AND (storage.foldername(name))[3] = (SELECT public.person_id())::text
  AND (storage.foldername(name))[4] = 'avatar'
);

CREATE POLICY "storage_update_self_avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (storage.foldername(name))[2] = 'people'
  AND (storage.foldername(name))[3] = (SELECT public.person_id())::text
  AND (storage.foldername(name))[4] = 'avatar'
)
WITH CHECK (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (storage.foldername(name))[2] = 'people'
  AND (storage.foldername(name))[3] = (SELECT public.person_id())::text
  AND (storage.foldername(name))[4] = 'avatar'
);

CREATE POLICY "storage_delete_self_avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (storage.foldername(name))[2] = 'people'
  AND (storage.foldername(name))[3] = (SELECT public.person_id())::text
  AND (storage.foldername(name))[4] = 'avatar'
);

-- Managers also need to update avatar_path on their own row (covered by people_update_manager).
-- Ensure employees/admins can update avatar_path on self via existing update policies.
