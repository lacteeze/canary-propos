-- 0026_add_units_hospitable_property_id.sql
-- Links a unit to a Hospitable property UUID for STR calendar overlay matching.

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS hospitable_property_id TEXT;

COMMENT ON COLUMN public.units.hospitable_property_id IS
  'Hospitable Public API property UUID — used to match STR reservations on the leases timeline.';

-- One Hospitable listing per org unit (NULL allowed for long-term-only units).
CREATE UNIQUE INDEX IF NOT EXISTS units_org_hospitable_property_id_uidx
  ON public.units (org_id, hospitable_property_id)
  WHERE hospitable_property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS units_hospitable_property_id_idx
  ON public.units (hospitable_property_id)
  WHERE hospitable_property_id IS NOT NULL;
