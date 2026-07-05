-- 0007_units_plan_limit.sql
-- Minimal units table sufficient to enforce plan limits now.
-- Full properties/units schema ships in Phase 2; this file establishes the DB gate.
-- ORGS-06: enforce_plan_unit_limit() trigger rejects INSERT when org is at its plan limit.
-- The matching Server Action pre-check (friendly error) ships with unit creation UI in Phase 2;
-- this trigger is the authoritative gate regardless of caller (DB layer, not UI-only).

-- ============================================================
-- units table (minimal — full schema in Phase 2)
-- ============================================================
CREATE TABLE public.units (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label       TEXT,         -- e.g., "Unit 2B", "Basement Suite"
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Index for plan-limit count queries and RLS org isolation
CREATE INDEX ON public.units (org_id);

-- ============================================================
-- RLS policies for units
-- (SELECT ...) wrapper on all helper calls per Pitfall 2
-- ============================================================

-- SELECT: managers, employees, admins see units in their org
CREATE POLICY "units_select_staff"
ON public.units
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- SELECT: admin cross-org access (FOUND-07)
CREATE POLICY "units_select_admin"
ON public.units
FOR SELECT
TO authenticated
USING (
  (SELECT public.user_role()) = 'admin'
);

-- INSERT: managers can add units (trigger enforces plan limit before row lands)
CREATE POLICY "units_insert_manager"
ON public.units
FOR INSERT
TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- UPDATE: managers can update units in their org
CREATE POLICY "units_update_manager"
ON public.units
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

-- DELETE: managers can delete units in their org
CREATE POLICY "units_delete_manager"
ON public.units
FOR DELETE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- ============================================================
-- Plan-limit enforcement trigger (ORGS-06)
-- Final gate: INSERT is physically rejected when org is at capacity.
-- Server Action pre-check (friendly user error) ships in Phase 2 unit creation UI.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_plan_unit_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_count  INTEGER;
  unit_limit     INTEGER;
BEGIN
  -- Count existing units for this org
  SELECT COUNT(*)
  INTO current_count
  FROM public.units
  WHERE org_id = NEW.org_id;

  -- Fetch the org's plan limit
  SELECT plan_unit_limit
  INTO unit_limit
  FROM public.organizations
  WHERE id = NEW.org_id;

  IF current_count >= unit_limit THEN
    RAISE EXCEPTION
      'plan_unit_limit_exceeded: org % is at its plan limit of %',
      NEW.org_id, unit_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger: fires BEFORE INSERT so the row is rejected before it lands
CREATE TRIGGER trg_enforce_plan_unit_limit
BEFORE INSERT ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.enforce_plan_unit_limit();
