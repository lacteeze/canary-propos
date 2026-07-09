-- Allow units.status = 'str' for short-term rental inventory.
-- Replaces the Phase 2 check constraint from 0010_extend_units.sql.

ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_status_check;

ALTER TABLE public.units
  ADD CONSTRAINT units_status_check
  CHECK (status IN ('vacant', 'occupied', 'maintenance', 'str'));
