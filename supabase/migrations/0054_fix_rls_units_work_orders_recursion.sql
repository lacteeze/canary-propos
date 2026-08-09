-- 0054_fix_rls_units_work_orders_recursion.sql
-- Break RLS cycles introduced by 0050 (vendor→work_orders) + 0053 (tenant→units):
--   units/properties vendor policies SELECT work_orders
--   work_orders tenant policy JOINs units
-- → infinite recursion; PostgREST returns error; load-db swallows it → empty properties.
--
-- SECURITY DEFINER helpers bypass RLS on the inner lookup only; they remain
-- scoped to the caller's JWT person_id().

CREATE OR REPLACE FUNCTION public.vendor_assigned_property_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wo.property_id
  FROM public.work_orders wo
  WHERE wo.assigned_vendor_id = (SELECT public.person_id())
    AND wo.property_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.tenant_active_unit_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.unit_id
  FROM public.leases l
  WHERE l.tenant_id = (SELECT public.person_id())
    AND l.status = 'active'
    AND l.unit_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.tenant_active_property_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.property_id
  FROM public.leases l
  JOIN public.units u ON u.id = l.unit_id
  WHERE l.tenant_id = (SELECT public.person_id())
    AND l.status = 'active'
    AND u.property_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.vendor_assigned_property_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_active_unit_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_active_property_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_assigned_property_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_active_unit_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_active_property_ids() TO authenticated;

DROP POLICY IF EXISTS properties_select_vendor_assigned ON public.properties;
CREATE POLICY properties_select_vendor_assigned ON public.properties
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.user_role()) = 'vendor'
    AND id IN (SELECT public.vendor_assigned_property_ids())
  );

DROP POLICY IF EXISTS units_select_vendor_assigned ON public.units;
CREATE POLICY units_select_vendor_assigned ON public.units
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.user_role()) = 'vendor'
    AND property_id IN (SELECT public.vendor_assigned_property_ids())
  );

DROP POLICY IF EXISTS tenants_select_own ON public.work_orders;
CREATE POLICY tenants_select_own ON public.work_orders
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.user_role()) = 'tenant'
    AND (
      created_by = (SELECT public.person_id())
      OR unit_id IN (SELECT public.tenant_active_unit_ids())
      OR property_id IN (SELECT public.tenant_active_property_ids())
    )
  );

-- Migration 0027 recorded as applied but these columns are missing in production.
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS appsheet_unique_id TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_appsheet_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS leases_org_appsheet_unique_id_uidx
  ON public.leases (org_id, appsheet_unique_id)
  WHERE appsheet_unique_id IS NOT NULL;
