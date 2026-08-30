-- 0059_listings_rental_credit.sql
-- Draft listings can carry the same rental-credit fields as leases so staff
-- can set amount + expiry before Activate lease copies them onto the lease.
-- Depends on: 0014_create_listings.sql, 0027_extend_leases_csv_fields.sql
-- RLS is already table-level on listings; no new policies.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS rental_credit        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rental_credit_expiry DATE;

COMMENT ON COLUMN public.listings.rental_credit IS
  'Dollar amount credited against listed monthly rent until rental_credit_expiry';
COMMENT ON COLUMN public.listings.rental_credit_expiry IS
  'Inclusive date the rental credit applies through; null means credit has no end date';
