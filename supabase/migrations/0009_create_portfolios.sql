-- 0009_create_portfolios.sql
-- Creates the portfolios table and adds portfolio_id FK back to properties.
-- Depends on: 0008_create_properties.sql (properties table must exist first).
-- RLS pattern: all helper calls wrapped in (SELECT ...) per established 0005 pattern.

-- ============================================================
-- portfolios table
-- ============================================================
CREATE TABLE public.portfolios (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id    UUID          REFERENCES public.people(id) ON DELETE SET NULL,
  name        TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   DEFAULT now(),
  updated_at  TIMESTAMPTZ   DEFAULT now()
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.portfolios (org_id);
CREATE INDEX ON public.portfolios (owner_id);

-- ============================================================
-- Add portfolio_id FK to properties (now that portfolios table exists)
-- ============================================================
ALTER TABLE public.properties
  ADD COLUMN portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL;

CREATE INDEX ON public.properties (portfolio_id);

-- ============================================================
-- RLS policies for portfolios
-- ============================================================

-- Staff (manager, employee, admin): SELECT all portfolios within their org
CREATE POLICY "portfolios_select_staff"
ON public.portfolios
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- Admin: SELECT portfolios across all orgs (no org_id check)
CREATE POLICY "portfolios_select_admin"
ON public.portfolios
FOR SELECT
TO authenticated
USING (
  (SELECT public.user_role()) = 'admin'
);

-- Owners: SELECT only their own portfolios
CREATE POLICY "portfolios_select_owner"
ON public.portfolios
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'owner'
  AND owner_id = (SELECT public.person_id())
);

-- Manager/admin: INSERT portfolios within their org
CREATE POLICY "portfolios_insert_manager"
ON public.portfolios
FOR INSERT
TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- Manager/admin: UPDATE portfolios within their org
CREATE POLICY "portfolios_update_manager"
ON public.portfolios
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

-- Manager/admin: DELETE portfolios within their org
CREATE POLICY "portfolios_delete_manager"
ON public.portfolios
FOR DELETE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);
