-- 0005_rls_people.sql
-- RLS policies for public.people.
-- Every helper call is wrapped in (SELECT ...) — once per query evaluation (Pitfall 2).
-- Admin: full cross-org access (FOUND-07).
-- Manager/employee: full CRUD within their org (FOUND-08, FOUND-09).
-- Tenant/owner/vendor: SELECT their own person row only (FOUND-10, FOUND-11, FOUND-12).

-- ============================================================
-- SELECT policies
-- ============================================================

-- Managers and employees: SELECT all people in their org
CREATE POLICY "people_select_staff"
ON public.people
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee')
);

-- Admin: SELECT all people across all orgs (FOUND-07)
CREATE POLICY "people_select_admin"
ON public.people
FOR SELECT
TO authenticated
USING (
  (SELECT public.user_role()) = 'admin'
);

-- Non-staff roles: SELECT their own row only (minimal self-read, FOUND-10/11/12)
CREATE POLICY "people_select_self"
ON public.people
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('tenant', 'owner', 'vendor')
);

-- ============================================================
-- INSERT policies
-- ============================================================

-- Managers: INSERT new people in their org (inviting members)
CREATE POLICY "people_insert_manager"
ON public.people
FOR INSERT
TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'manager'
);

-- Admin: INSERT people in any org
CREATE POLICY "people_insert_admin"
ON public.people
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT public.user_role()) = 'admin'
);

-- ============================================================
-- UPDATE policies
-- ============================================================

-- Managers: UPDATE any person in their org (edit details, deactivate)
CREATE POLICY "people_update_manager"
ON public.people
FOR UPDATE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'manager'
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'manager'
);

-- Employees: UPDATE within their org (limited; same as manager for schema purposes;
-- additional business logic restricts what employees can update at the Server Action layer)
CREATE POLICY "people_update_employee"
ON public.people
FOR UPDATE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'employee'
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'employee'
);

-- Admin: UPDATE any person across all orgs
CREATE POLICY "people_update_admin"
ON public.people
FOR UPDATE
TO authenticated
USING (
  (SELECT public.user_role()) = 'admin'
)
WITH CHECK (
  (SELECT public.user_role()) = 'admin'
);

-- Non-staff: UPDATE their own record only (e.g., phone, name)
CREATE POLICY "people_update_self"
ON public.people
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('tenant', 'owner', 'vendor')
)
WITH CHECK (
  user_id = auth.uid()
  AND org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('tenant', 'owner', 'vendor')
);

-- ============================================================
-- DELETE policies
-- ============================================================

-- Managers: DELETE (deactivate) people in their org
CREATE POLICY "people_delete_manager"
ON public.people
FOR DELETE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'manager'
);

-- Admin: DELETE any person across all orgs
CREATE POLICY "people_delete_admin"
ON public.people
FOR DELETE
TO authenticated
USING (
  (SELECT public.user_role()) = 'admin'
);
