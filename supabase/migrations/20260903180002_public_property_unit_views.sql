-- B3: public property/unit column projections. Anon cannot read owner_id or fees.
-- Table policies scoped to marketed rows (slug or a published listing).
-- Column grants keep existing listing embeds working; views are the public API.

DROP VIEW IF EXISTS public.public_properties;
CREATE VIEW public.public_properties
  WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.org_id,
  p.slug,
  p.street_address,
  p.city,
  p.province,
  p.property_type,
  p.photo_paths,
  p.listing_brief
FROM public.properties p
WHERE p.slug IS NOT NULL
   OR EXISTS (
     SELECT 1
     FROM public.units u
     JOIN public.listings l ON l.unit_id = u.id
     WHERE u.property_id = p.id
       AND l.status = 'published'
   );

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

GRANT SELECT ON public.public_properties TO anon, authenticated;
GRANT SELECT ON public.public_units TO anon, authenticated;

DROP POLICY IF EXISTS "properties_select_anon" ON public.properties;
CREATE POLICY "properties_select_anon"
ON public.properties
FOR SELECT
TO anon
USING (
  slug IS NOT NULL
  OR EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.listings l ON l.unit_id = u.id
    WHERE u.property_id = properties.id
      AND l.status = 'published'
  )
);

DROP POLICY IF EXISTS "units_select_anon" ON public.units;
CREATE POLICY "units_select_anon"
ON public.units
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.listings l
    WHERE l.unit_id = units.id
      AND l.status = 'published'
  )
  OR EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = units.property_id
      AND p.slug IS NOT NULL
  )
);

REVOKE SELECT ON public.properties FROM anon;
GRANT SELECT (
  id,
  org_id,
  slug,
  street_address,
  city,
  province,
  property_type,
  photo_paths,
  listing_brief
) ON public.properties TO anon;

REVOKE SELECT ON public.units FROM anon;
GRANT SELECT (
  id,
  org_id,
  property_id,
  bedrooms,
  bathrooms,
  sq_footage,
  amenities,
  status,
  hospitable_widget_property_id,
  hospitable_property_id,
  asking_rent,
  unit_number
) ON public.units TO anon;
