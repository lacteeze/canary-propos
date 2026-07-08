-- 0028_add_units_archived_at.sql
-- Soft-archive units (properties in CanaryApp) when no longer under management.
-- Archived units are hidden from default views but can be restored later.

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.units.archived_at IS
  'When set, unit is archived (offboarded) and hidden from active property views.';

CREATE INDEX IF NOT EXISTS units_archived_at_idx
  ON public.units (org_id, archived_at)
  WHERE archived_at IS NOT NULL;
