-- Keep public /{slug} and /listings/{id} working after a home is leased.
-- Anon RLS only returns published listings, so unpublished listing slugs/UUIDs
-- 404'd instead of falling through to the property page (no price / no dates).

-- True when any active lease exists (including month-to-month with null end_date).
-- Does not expose lease dates or tenant PII.
CREATE OR REPLACE FUNCTION public.public_property_is_leased(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leases l
    JOIN public.units u ON u.id = l.unit_id
    WHERE u.property_id = p_property_id
      AND l.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.public_property_is_leased(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_property_is_leased(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.public_property_is_leased(UUID) IS
  'True when the property has an active lease. Safe for anon public property pages; no dates or PII.';

-- Resolve a public slug to a slugged property: property.slug first, then any listing slug.
CREATE OR REPLACE FUNCTION public.public_property_id_for_slug(p_org_id UUID, p_slug TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM (
    SELECT p.id, 0 AS pri
    FROM public.properties p
    WHERE p.org_id = p_org_id
      AND p.slug = p_slug
      AND p.slug IS NOT NULL
    UNION ALL
    SELECT u.property_id, 1 AS pri
    FROM public.listings l
    JOIN public.units u ON u.id = l.unit_id
    JOIN public.properties p ON p.id = u.property_id
    WHERE l.org_id = p_org_id
      AND l.slug = p_slug
      AND u.property_id IS NOT NULL
      AND p.slug IS NOT NULL
  ) resolved
  ORDER BY pri
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.public_property_id_for_slug(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_property_id_for_slug(UUID, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.public_property_id_for_slug(UUID, TEXT) IS
  'Maps a public URL slug to a property id (property slug or any listing slug). Anon-safe.';

-- Resolve a listing UUID (published or not) to its slugged property.
CREATE OR REPLACE FUNCTION public.public_property_id_for_listing(p_org_id UUID, p_listing_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.property_id
  FROM public.listings l
  JOIN public.units u ON u.id = l.unit_id
  JOIN public.properties p ON p.id = u.property_id
  WHERE l.id = p_listing_id
    AND l.org_id = p_org_id
    AND u.property_id IS NOT NULL
    AND p.slug IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.public_property_id_for_listing(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_property_id_for_listing(UUID, UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.public_property_id_for_listing(UUID, UUID) IS
  'Maps a listing id to its property for public pages after the listing is unlisted. Anon-safe.';
