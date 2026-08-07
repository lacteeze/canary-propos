-- 0053_tenant_work_orders_unit_scope.sql
-- Tenants may SELECT work orders they created OR on their active lease unit/property.
-- Viewer model for MVP: leases.tenant_id → people (no separate share table).
-- Co-tenants in appsheet_tenant_ids are NOT granted access (single primary tenant only).

DROP POLICY IF EXISTS tenants_select_own ON public.work_orders;

CREATE POLICY tenants_select_own ON public.work_orders
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.user_role()) = 'tenant'
    AND (
      created_by = (SELECT public.person_id())
      OR unit_id IN (
        SELECT l.unit_id
        FROM public.leases l
        WHERE l.tenant_id = (SELECT public.person_id())
          AND l.status = 'active'
          AND l.unit_id IS NOT NULL
      )
      OR property_id IN (
        SELECT u.property_id
        FROM public.leases l
        JOIN public.units u ON u.id = l.unit_id
        WHERE l.tenant_id = (SELECT public.person_id())
          AND l.status = 'active'
      )
    )
  );
