-- 0029_leases_optional_tenant.sql
-- Allow bulk lease import before tenants are linked in PropOS.
-- Managers assign tenant_id later via the lease editor dropdown.

ALTER TABLE public.leases
  ALTER COLUMN tenant_id DROP NOT NULL;

COMMENT ON COLUMN public.leases.tenant_id IS
  'Primary tenant FK — optional during AppSheet CSV import; link later from People.';
