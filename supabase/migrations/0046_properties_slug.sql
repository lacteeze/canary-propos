-- 0046_properties_slug.sql
-- Stable public SEO slugs for every property (org-scoped unique).
-- Expands anon read so /{slug} works for leased / unpublished units.
-- Does NOT put leased properties into browse/carousels (app still filters published listings).

ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS properties_org_id_slug_key
  ON public.properties (org_id, slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN public.properties.slug IS
  'Stable public URL segment for /{slug}. Unique per org when set.';

-- Prefer existing listing slug for the property (keeps published URLs stable)
WITH listing_slugs AS (
  SELECT DISTINCT ON (u.property_id)
    u.property_id,
    l.org_id,
    l.slug
  FROM public.listings l
  JOIN public.units u ON u.id = l.unit_id
  WHERE l.slug IS NOT NULL
    AND u.property_id IS NOT NULL
  ORDER BY
    u.property_id,
    CASE WHEN l.status = 'published' THEN 0 ELSE 1 END,
    l.created_at NULLS LAST,
    l.id
)
UPDATE public.properties p
SET slug = ls.slug
FROM listing_slugs ls
WHERE p.id = ls.property_id
  AND p.slug IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.properties p2
    WHERE p2.org_id = p.org_id
      AND p2.slug = ls.slug
      AND p2.id <> p.id
  );

-- Reserved path segments (mirrors src/lib/listings/reserved-slugs.ts)
WITH reserved AS (
  SELECT unnest(ARRAY[
    'app', 'login', 'signup', 'listings', 'invite', 'onboarding', 'admin',
    'owner', 'my-home', 'jobs', 'portfolio', 'people', 'properties', 'leases',
    'payments', 'maintenance', 'dashboard', 'settings', 'auth-code-error',
    'receipts', 'api', 'vendor', 'inquiries', '_next', 'listing', 'property'
  ]) AS slug
),
base_rows AS (
  SELECT
    p.id,
    p.org_id,
    CASE
      WHEN length(trim(both '-' FROM
        regexp_replace(
          lower(trim(split_part(coalesce(p.street_address, ''), ',', 1))),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      )) = 0
      THEN 'property-' || left(replace(p.id::text, '-', ''), 8)
      ELSE trim(both '-' FROM
        regexp_replace(
          lower(trim(split_part(coalesce(p.street_address, ''), ',', 1))),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      )
    END AS base_slug
  FROM public.properties p
  WHERE p.slug IS NULL
),
adjusted AS (
  SELECT
    b.id,
    b.org_id,
    CASE
      WHEN EXISTS (SELECT 1 FROM reserved r WHERE r.slug = b.base_slug)
        OR b.base_slug IN ('listing', 'property')
      THEN 'property-' || left(replace(b.id::text, '-', ''), 8)
      ELSE b.base_slug
    END AS base_slug
  FROM base_rows b
),
ranked AS (
  SELECT
    a.id,
    a.org_id,
    a.base_slug,
    row_number() OVER (
      PARTITION BY a.org_id, a.base_slug
      ORDER BY a.id
    ) AS rn
  FROM adjusted a
)
UPDATE public.properties p
SET slug = CASE
  WHEN r.rn = 1
    AND NOT EXISTS (
      SELECT 1 FROM public.properties p2
      WHERE p2.org_id = r.org_id
        AND p2.slug = r.base_slug
        AND p2.id <> r.id
    )
  THEN r.base_slug
  ELSE r.base_slug || '-' || r.rn::text
END
FROM ranked r
WHERE p.id = r.id
  AND p.slug IS NULL;

-- Resolve remaining collisions against already-assigned property slugs (from listing copy)
WITH collisions AS (
  SELECT
    p.id,
    p.org_id,
    p.slug AS desired,
    row_number() OVER (
      PARTITION BY p.org_id, p.slug
      ORDER BY p.id
    ) AS rn
  FROM public.properties p
  WHERE p.slug IS NOT NULL
)
UPDATE public.properties p
SET slug = c.desired || '-' || c.rn::text
FROM collisions c
WHERE p.id = c.id
  AND c.rn > 1;

-- Public lease end date only (no tenant PII)
CREATE OR REPLACE FUNCTION public.public_property_lease_end(p_property_id UUID)
RETURNS DATE
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT MAX(l.end_date)
  FROM public.leases l
  JOIN public.units u ON u.id = l.unit_id
  WHERE u.property_id = p_property_id
    AND l.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.public_property_lease_end(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_property_lease_end(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.public_property_lease_end(UUID) IS
  'Returns max end_date among active leases for a property. Safe for anon public property pages.';

-- Anon: any property with a public slug (leased included)
DROP POLICY IF EXISTS "properties_select_anon" ON public.properties;
CREATE POLICY "properties_select_anon"
ON public.properties
FOR SELECT
TO anon
USING (slug IS NOT NULL);

-- Anon: units under a slugged property (for beds/baths/amenities on property pages)
DROP POLICY IF EXISTS "units_select_anon" ON public.units;
CREATE POLICY "units_select_anon"
ON public.units
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = units.property_id
      AND p.slug IS NOT NULL
  )
);

-- Anon: listing-visibility media for any slugged property
DROP POLICY IF EXISTS "property_media_select_anon_listing" ON public.property_media;
CREATE POLICY "property_media_select_anon_listing"
ON public.property_media
FOR SELECT
TO anon
USING (
  visibility = 'listing'
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_media.property_id
      AND p.slug IS NOT NULL
  )
);

COMMENT ON POLICY "property_media_select_anon_listing" ON public.property_media IS
  'listing visibility media is readable when the property has a public slug';

-- Storage: listing photo objects for slugged properties
DROP POLICY IF EXISTS "storage_select_anon_listing_photos" ON storage.objects;
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
    WHERE p.id::text = (storage.foldername(name))[3]
      AND p.slug IS NOT NULL
  )
);
