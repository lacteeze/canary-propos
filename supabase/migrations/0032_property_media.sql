-- 0032_property_media.sql
-- Property media with listing vs private visibility.
-- Listing photos are inherited by published listings and readable by anon when live.
-- Private photos (inspections, historical/pre-reno) are staff-only.
-- Existing properties.photo_paths rows are migrated into listing visibility.

CREATE TABLE IF NOT EXISTS public.property_media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id   UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  visibility    TEXT NOT NULL CHECK (visibility IN ('listing', 'private')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  caption       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, storage_path)
);

CREATE INDEX IF NOT EXISTS property_media_property_visibility_idx
  ON public.property_media (property_id, visibility, sort_order);

CREATE INDEX IF NOT EXISTS property_media_org_idx
  ON public.property_media (org_id);

COMMENT ON TABLE public.property_media IS
  'Property photos. visibility=listing is marketing media inherited by published listings; visibility=private is staff-only.';

COMMENT ON COLUMN public.property_media.visibility IS
  'listing = public when property has a published listing; private = staff only (inspections, historical, pre-reno).';

-- Migrate legacy photo_paths → listing media (preserve order)
INSERT INTO public.property_media (org_id, property_id, storage_path, visibility, sort_order)
SELECT
  p.org_id,
  p.id,
  path,
  'listing',
  ord - 1
FROM public.properties p
CROSS JOIN LATERAL unnest(COALESCE(p.photo_paths, ARRAY[]::TEXT[])) WITH ORDINALITY AS t(path, ord)
WHERE path IS NOT NULL AND btrim(path) <> ''
ON CONFLICT (property_id, storage_path) DO NOTHING;

ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;

-- Staff: managers/employees/admins in the org can read all media
CREATE POLICY "property_media_select_staff"
ON public.property_media
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- Staff write: managers/admins
CREATE POLICY "property_media_insert_manager_admin"
ON public.property_media
FOR INSERT
TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE POLICY "property_media_update_manager_admin"
ON public.property_media
FOR UPDATE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE POLICY "property_media_delete_manager_admin"
ON public.property_media
FOR DELETE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- Anon: listing media only when the property has a published listing
CREATE POLICY "property_media_select_anon_listing"
ON public.property_media
FOR SELECT
TO anon
USING (
  visibility = 'listing'
  AND EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.listings l ON l.unit_id = u.id
    WHERE u.property_id = property_media.property_id
      AND l.status = 'published'
  )
);

-- Storage: anon may read listing photo objects for properties with a live listing.
-- Path: {org_id}/properties/{property_id}/photos/{filename}
-- Private folder {org_id}/properties/{property_id}/private-photos/ stays staff-only.
CREATE POLICY "storage_select_anon_listing_photos"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[2] = 'properties'
  AND (storage.foldername(name))[4] = 'photos'
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    JOIN public.units u ON u.property_id = p.id
    JOIN public.listings l ON l.unit_id = u.id
    WHERE p.id::text = (storage.foldername(name))[3]
      AND l.status = 'published'
  )
);
