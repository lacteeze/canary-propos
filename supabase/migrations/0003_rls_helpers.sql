-- 0003_rls_helpers.sql
-- Auth Hook: fires at every sign-in, injects role/org_id/person_id into JWT app_metadata.
-- Helper functions: auth.org_id(), auth.user_role(), auth.person_id() — read JWT claims.
-- CRITICAL: SECURITY DEFINER + search_path = '' prevents privilege escalation.
-- Source: Supabase Auth Hooks documentation (Pattern 2 in 01-RESEARCH.md).

-- ============================================================
-- Auth Hook: custom_access_token_hook
-- Registered in Supabase Dashboard -> Authentication -> Hooks
-- (registration cannot be done via migration — see Task 4 in 01-02-PLAN.md)
-- ============================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims        jsonb;
  person_record record;
BEGIN
  -- Look up the person record associated with this user
  SELECT p.id, p.org_id, p.role
  INTO person_record
  FROM public.people p
  WHERE p.user_id = (event->>'user_id')::uuid
  LIMIT 1;

  claims := event->'claims';

  IF person_record IS NOT NULL THEN
    -- Inject org_id, role, and person_id into app_metadata
    -- These are the three JWT claims used by all RLS policies
    claims := jsonb_set(claims, '{app_metadata,org_id}',   to_jsonb(person_record.org_id::text));
    claims := jsonb_set(claims, '{app_metadata,role}',     to_jsonb(person_record.role));
    claims := jsonb_set(claims, '{app_metadata,person_id}', to_jsonb(person_record.id::text));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant EXECUTE to supabase_auth_admin (required for the hook to fire)
-- Revoke from all other roles — hook must not be callable by regular users
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ============================================================
-- JWT helper functions (in public schema — auth schema write access denied)
-- Always call these wrapped in (SELECT ...) inside RLS policies
-- e.g., org_id = (SELECT public.org_id())
-- This ensures the function is evaluated once per query, not per row (Pitfall 2).
-- ============================================================
CREATE OR REPLACE FUNCTION public.org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$;

CREATE OR REPLACE FUNCTION public.person_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'person_id')::uuid;
$$;

GRANT EXECUTE ON FUNCTION public.org_id TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_role TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.person_id TO authenticated, anon;

-- ============================================================
-- CI linter helper: tables_without_rls()
-- Called by scripts/check-rls.ts to gate CI on missing RLS.
-- Returns the tablename of any public table lacking row security.
-- ============================================================
CREATE OR REPLACE FUNCTION public.tables_without_rls()
RETURNS TABLE (tablename text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.tablename::text
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND NOT t.rowsecurity
  ORDER BY t.tablename;
$$;

GRANT EXECUTE ON FUNCTION public.tables_without_rls TO service_role;
