-- 0055_units_hospitable_widget_property_id.sql
-- Direct booking widget needs a numeric property id (data-property-id),
-- which is distinct from the Public API UUID in hospitable_property_id.

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS hospitable_widget_property_id TEXT;

COMMENT ON COLUMN public.units.hospitable_widget_property_id IS
  'Hospitable Direct Booking widget data-property-id (numeric string from Direct Bookings → Website → Copy widget code). Distinct from hospitable_property_id (Public API UUID).';

CREATE INDEX IF NOT EXISTS units_hospitable_widget_property_id_idx
  ON public.units (hospitable_widget_property_id)
  WHERE hospitable_widget_property_id IS NOT NULL;

-- 21 Front Road (Dildo): API UUID d26f423d-… → widget id 796518
UPDATE public.units u
SET hospitable_widget_property_id = '796518',
    updated_at = now()
FROM public.properties p
WHERE u.property_id = p.id
  AND u.hospitable_property_id = 'd26f423d-af7a-43c4-859b-45640c85bed5'
  AND (u.hospitable_widget_property_id IS NULL OR u.hospitable_widget_property_id = '');
