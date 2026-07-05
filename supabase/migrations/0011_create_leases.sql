-- 0011_create_leases.sql
-- Creates the leases table with renewal_status enum and RLS policies.
-- Depends on: 0010_extend_units.sql (units table with property_id FK).
-- Tenant lease SELECT policy: tenant can read only their own lease row.
-- Owner lease SELECT policy: owner can read leases on their properties via unit → property join.
-- RLS pattern: all helper calls wrapped in (SELECT ...) per established 0005 pattern.

-- ============================================================
-- Lease renewal status enum
-- ============================================================
CREATE TYPE public.renewal_status_enum AS ENUM (
  'pending', 'sent', 'accepted', 'declined'
);

-- ============================================================
-- leases table
-- ============================================================
CREATE TABLE public.leases (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id          UUID          NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  tenant_id        UUID          NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  start_date       DATE          NOT NULL,
  end_date         DATE          NOT NULL,
  monthly_rent     NUMERIC(10,2) NOT NULL,
  deposit_amount   NUMERIC(10,2) NOT NULL,
  rent_due_day     SMALLINT      NOT NULL DEFAULT 1 CHECK (rent_due_day BETWEEN 1 AND 28),
  status           TEXT          NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active', 'expired', 'terminated')),
  renewal_status   public.renewal_status_enum,
  proposed_rent    NUMERIC(10,2),
  document_path    TEXT,
  created_at       TIMESTAMPTZ   DEFAULT now(),
  updated_at       TIMESTAMPTZ   DEFAULT now()
);

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.leases (org_id);
CREATE INDEX ON public.leases (unit_id);
CREATE INDEX ON public.leases (tenant_id);
-- Partial index for expiry alert queries (only active leases queried by end_date)
CREATE INDEX ON public.leases (org_id, end_date) WHERE status = 'active';

-- ============================================================
-- RLS policies
-- ============================================================

-- Staff (manager, employee, admin): SELECT all leases within their org
CREATE POLICY "leases_select_staff"
ON public.leases
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- Admin: SELECT leases across all orgs (no org_id check)
CREATE POLICY "leases_select_admin"
ON public.leases
FOR SELECT
TO authenticated
USING (
  (SELECT public.user_role()) = 'admin'
);

-- Tenant: SELECT only their own lease (LEASE-06, FOUND-10)
CREATE POLICY "leases_select_tenant"
ON public.leases
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'tenant'
  AND tenant_id = (SELECT public.person_id())
);

-- Owner: SELECT leases on properties they own (via unit → property → owner_id)
CREATE POLICY "leases_select_owner"
ON public.leases
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'owner'
  AND EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE u.id = leases.unit_id
      AND p.owner_id = (SELECT public.person_id())
  )
);

-- Manager/admin: INSERT leases within their org
CREATE POLICY "leases_insert_manager"
ON public.leases
FOR INSERT
TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- Manager/admin: UPDATE leases within their org
CREATE POLICY "leases_update_manager"
ON public.leases
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

-- Manager/admin: DELETE leases within their org
CREATE POLICY "leases_delete_manager"
ON public.leases
FOR DELETE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);
