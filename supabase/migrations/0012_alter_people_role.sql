-- 0012_alter_people_role.sql
-- Migrates people.role from TEXT to TEXT[] to support multi-role contacts (D-06).
-- Three schema steps + Auth Hook update in a single migration for atomicity.
--
-- CRITICAL: Auth Hook is updated here to emit person_record.role[1] (first array element as text string).
-- This keeps the JWT role claim as a plain text string, not a JSON array.
-- All existing RLS policies read the JWT via public.user_role() which returns text — no policy changes needed.
--
-- Comment: "Emits first role element as JWT claim string. role text[] column is used by UI queries;
--           JWT claim stays a single string so RLS helper public.user_role() works unchanged."

-- ============================================================
-- Step 1: Drop the old single-value check constraint
-- ============================================================
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_role_check;

-- ============================================================
-- Step 2: Cast role column from text to text[] (preserve existing values)
-- ============================================================
ALTER TABLE public.people
  ALTER COLUMN role TYPE TEXT[]
  USING ARRAY[role];

-- ============================================================
-- Step 3: Add new constraint — must contain at least one valid role (array overlap)
-- ============================================================
ALTER TABLE public.people
  ADD CONSTRAINT people_role_valid CHECK (
    role && ARRAY['admin', 'manager', 'employee', 'tenant', 'owner', 'vendor']::text[]
  );

-- ============================================================
-- Step 4: Update Auth Hook to emit primary role (first array element) as JWT claim
-- ============================================================
-- Emits first role element as JWT claim string.
-- role text[] column is used by UI queries; JWT claim stays a single string
-- so RLS helper public.user_role() works unchanged.
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
    -- Inject org_id, role (first element only), and person_id into app_metadata.
    -- person_record.role[1] emits the first array element as a text string (not an array).
    -- All existing RLS policies remain valid — public.user_role() still returns a plain text string.
    claims := jsonb_set(claims, '{app_metadata,org_id}',    to_jsonb(person_record.org_id::text));
    claims := jsonb_set(claims, '{app_metadata,role}',      to_jsonb(person_record.role[1]));
    claims := jsonb_set(claims, '{app_metadata,person_id}', to_jsonb(person_record.id::text));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
