-- Advertised lease end on a listing (staff "Lease end" on listing create/edit).
-- Distinct from leases.end_date (current occupancy). Public details show this date.
-- Depends on: 0014_create_listings.sql
-- RLS is already table-level on listings; no new policies.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS available_until DATE;

COMMENT ON COLUMN public.listings.available_until IS
  'Advertised lease end for the listing offer; null means month-to-month or unspecified';
