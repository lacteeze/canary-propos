-- 0004_rls_organizations.sql
-- RLS policies for public.organizations.
-- Every helper call is wrapped in (SELECT ...) — evaluated once per query, not per row (Pitfall 2).
-- Admin role gets cross-org access (FOUND-07).
-- Non-staff roles (tenant, owner, vendor) get SELECT on their own org only.

-- ============================================================
-- SELECT policies
-- ============================================================

-- Managers and employees: SELECT their own org
CREATE POLICY "orgs_select_staff"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee')
);

-- Admin: SELECT all orgs (cross-org superuser, FOUND-07)
CREATE POLICY "orgs_select_admin"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  (SELECT public.user_role()) = 'admin'
);

-- Tenants, owners, vendors: SELECT their own org row only
CREATE POLICY "orgs_select_nonstaff"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('tenant', 'owner', 'vendor')
);

-- ============================================================
-- UPDATE policies
-- ============================================================

-- Managers: UPDATE their own org (org settings, logo, province, etc.)
CREATE POLICY "orgs_update_manager"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'manager'
)
WITH CHECK (
  id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'manager'
);

-- Admin: UPDATE any org (cross-org)
CREATE POLICY "orgs_update_admin"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  (SELECT public.user_role()) = 'admin'
)
WITH CHECK (
  (SELECT public.user_role()) = 'admin'
);

-- ============================================================
-- INSERT policies
-- ============================================================

-- Only admin can INSERT new organizations directly
-- (normal sign-up flow goes through a Server Action using service_role)
CREATE POLICY "orgs_insert_admin"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT public.user_role()) = 'admin'
);

-- ============================================================
-- DELETE policies
-- ============================================================

-- Only admin can DELETE organizations (platform-level operation)
CREATE POLICY "orgs_delete_admin"
ON public.organizations
FOR DELETE
TO authenticated
USING (
  (SELECT public.user_role()) = 'admin'
);
