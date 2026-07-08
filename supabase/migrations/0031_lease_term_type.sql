-- 0031_lease_term_type.sql
-- Month-to-month vs fixed-term lease distinction for timeline styling and validation.
-- Depends on: 0027_extend_leases_csv_fields.sql (nullable end_date)

CREATE TYPE public.lease_term_type_enum AS ENUM ('fixed_term', 'month_to_month');

ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS lease_term_type public.lease_term_type_enum NOT NULL DEFAULT 'fixed_term';

COMMENT ON COLUMN public.leases.lease_term_type IS 'fixed_term requires end_date; month_to_month allows optional end_date (max 12 months from start).';

-- Existing open-ended leases → month-to-month
UPDATE public.leases
SET lease_term_type = 'month_to_month'
WHERE end_date IS NULL
  AND lease_term_type = 'fixed_term';
