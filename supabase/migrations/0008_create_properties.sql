-- 0008_create_properties.sql
-- Creates the properties table with RLS policies.
-- NOTE: portfolio_id FK is NOT added here — portfolios table does not exist yet.
-- portfolio_id is added in 0009_create_portfolios.sql after portfolios table exists.
-- RLS pattern: all helper calls wrapped in (SELECT ...) per established 0005 pattern.

-- ============================================================
-- Property type enum
-- ============================================================
CREATE TYPE public.property_type_enum AS ENUM (
  'house', 'duplex', 'apartment_building', 'condo', 'townhouse', 'other'
);

-- ============================================================
-- properties table
-- ============================================================
CREATE TABLE public.properties (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id        UUID          REFERENCES public.people(id) ON DELETE SET NULL,
  street_address  TEXT          NOT NULL,
  city            TEXT          NOT NULL,
  province        TEXT          NOT NULL,
  postal_code     TEXT,
  property_type   public.property_type_enum NOT NULL DEFAULT 'house',
  photo_paths     TEXT[],
  created_at      TIMESTAMPTZ   DEFAULT now(),
  updated_at      TIMESTAMPTZ   DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.properties (org_id);
CREATE INDEX ON public.properties (owner_id);

-- ============================================================
-- RLS policies
-- ============================================================

-- Staff (manager, employee, admin): SELECT all properties within their org
CREATE POLICY "properties_select_staff"
ON public.properties
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- Admin: SELECT properties across all orgs (no org_id check)
CREATE POLICY "properties_select_admin"
ON public.properties
FOR SELECT
TO authenticated
USING (
  (SELECT public.user_role()) = 'admin'
);

-- Owners: SELECT only properties they own
CREATE POLICY "properties_select_owner"
ON public.properties
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'owner'
  AND owner_id = (SELECT public.person_id())
);

-- Manager/admin: INSERT properties within their org
CREATE POLICY "properties_insert_manager"
ON public.properties
FOR INSERT
TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- Manager/admin: UPDATE properties within their org
CREATE POLICY "properties_update_manager"
ON public.properties
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

-- Manager/admin: DELETE properties within their org
CREATE POLICY "properties_delete_manager"
ON public.properties
FOR DELETE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);
