-- getPublishedListings selects asking_rent from public_units. If that
-- column is missing, PostgREST rejects the whole query and listing cards
-- lose beds, baths, property joins, and signed cover photos.

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
