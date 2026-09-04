-- Public listing photos and detail pages broke after column-level grants on
-- properties/units: PostgREST embeds fail, and anon RLS subqueries on those
-- tables can error so listing media/storage reads return empty.

CREATE OR REPLACE FUNCTION public.property_is_publicly_marketed(p_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = p_property_id
      AND (
        p.slug IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM public.units u
          JOIN public.listings l ON l.unit_id = u.id
          WHERE u.property_id = p.id
            AND l.status = 'published'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.property_is_publicly_marketed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.property_is_publicly_marketed(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.property_is_publicly_marketed(uuid) IS
  'True when the property has a public slug or a published listing. SECURITY DEFINER so anon photo RLS does not depend on column grants.';

DROP POLICY IF EXISTS "property_media_select_anon_listing" ON public.property_media;
CREATE POLICY "property_media_select_anon_listing"
ON public.property_media
FOR SELECT
TO anon
USING (
  visibility = 'listing'
  AND public.property_is_publicly_marketed(property_id)
);

DROP POLICY IF EXISTS "storage_select_anon_listing_photos" ON storage.objects;
CREATE POLICY "storage_select_anon_listing_photos"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[2] = 'properties'
  AND (storage.foldername(name))[4] = 'photos'
  AND (storage.foldername(name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.property_is_publicly_marketed(((storage.foldername(name))[3])::uuid)
);

-- asking_rent is the advertised list price (already granted to anon on units).
DROP VIEW IF EXISTS public.public_units;
CREATE VIEW public.public_units
  WITH (security_invoker = false)
AS
SELECT
  u.id,
  u.property_id,
  u.bedrooms,
  u.bathrooms,
  u.sq_footage,
  u.amenities,
  u.status,
  u.asking_rent,
  u.hospitable_widget_property_id,
  u.hospitable_property_id
FROM public.units u
WHERE u.archived_at IS NULL
  AND (
    EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = u.property_id
        AND p.slug IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.unit_id = u.id
        AND l.status = 'published'
    )
  );

GRANT SELECT ON public.public_units TO anon, authenticated;
