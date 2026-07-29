-- 0043_listings_slug.sql
-- SEO-friendly address slugs for public listings (org-scoped unique).
-- Does not change RLS.

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS listings_org_id_slug_key
  ON public.listings (org_id, slug)
  WHERE slug IS NOT NULL;

-- Reserved path segments that must not become listing slugs
-- (mirrors src/lib/listings/reserved-slugs.ts)

WITH reserved AS (
  SELECT unnest(ARRAY[
    'app', 'login', 'signup', 'listings', 'invite', 'onboarding', 'admin',
    'owner', 'my-home', 'jobs', 'portfolio', 'people', 'properties', 'leases',
    'payments', 'maintenance', 'dashboard', 'settings', 'auth-code-error',
    'receipts', 'api', 'vendor', 'inquiries', '_next', 'listing'
  ]) AS slug
),
base_rows AS (
  SELECT
    l.id,
    l.org_id,
    CASE
      WHEN length(trim(both '-' FROM
        regexp_replace(
          lower(trim(split_part(coalesce(p.street_address, ''), ',', 1))),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      )) = 0
      THEN 'listing-' || left(replace(l.id::text, '-', ''), 8)
      ELSE trim(both '-' FROM
        regexp_replace(
          lower(trim(split_part(coalesce(p.street_address, ''), ',', 1))),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      )
    END AS base_slug
  FROM public.listings l
  JOIN public.units u ON u.id = l.unit_id
  JOIN public.properties p ON p.id = u.property_id
  WHERE l.slug IS NULL
),
adjusted AS (
  SELECT
    b.id,
    b.org_id,
    CASE
      WHEN EXISTS (SELECT 1 FROM reserved r WHERE r.slug = b.base_slug)
        OR b.base_slug = 'listing'
      THEN 'listing-' || left(replace(b.id::text, '-', ''), 8)
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
UPDATE public.listings l
SET slug = CASE
  WHEN r.rn = 1 THEN r.base_slug
  ELSE r.base_slug || '-' || r.rn::text
END
FROM ranked r
WHERE l.id = r.id
  AND l.slug IS NULL;
