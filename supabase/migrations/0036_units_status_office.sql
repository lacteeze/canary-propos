-- Allow units.status = 'office' for manager office / non-residential inventory.

ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_status_check;

ALTER TABLE public.units
  ADD CONSTRAINT units_status_check
  CHECK (status IN ('vacant', 'occupied', 'maintenance', 'str', 'office'));
