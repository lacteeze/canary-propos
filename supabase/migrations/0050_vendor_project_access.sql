-- 0050_vendor_project_access.sql
-- Trusted vendors can SELECT work orders assigned to them, plus the linked
-- property/unit rows needed to show a short address in CanaryApp Projects.

-- Vendors: read only work orders where they are the assigned vendor
CREATE POLICY vendors_select_assigned ON public.work_orders
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.user_role()) = 'vendor'
    AND assigned_vendor_id = (SELECT public.person_id())
  );

-- Vendors: read properties that have at least one assigned work order
CREATE POLICY properties_select_vendor_assigned ON public.properties
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.user_role()) = 'vendor'
    AND id IN (
      SELECT wo.property_id
      FROM public.work_orders wo
      WHERE wo.assigned_vendor_id = (SELECT public.person_id())
    )
  );

-- Vendors: read units on those same properties (CanaryApp loads properties via units)
CREATE POLICY units_select_vendor_assigned ON public.units
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.user_role()) = 'vendor'
    AND property_id IN (
      SELECT wo.property_id
      FROM public.work_orders wo
      WHERE wo.assigned_vendor_id = (SELECT public.person_id())
    )
  );
