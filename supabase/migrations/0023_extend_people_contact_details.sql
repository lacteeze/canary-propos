-- 0023_extend_people_contact_details.sql
-- Extends people with CRM-style contact details so tenant inquiries, vendors,
-- realtors and accountants can live in the same user base:
--   * company / mailing_address / website / services / rating / notes / status
--   * tenant-inquiry preference fields (min_bedrooms, min_bathrooms,
--     min_parking, pet_preference, move_in_date, lease_type, max_price)
--   * widens the role constraint with realtor, accountant and contact
-- Preference fields are only meaningful for tenants; the UI hides them for
-- other roles. Existing RLS policies are unaffected (org_id scoping unchanged).

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS company          TEXT,
  ADD COLUMN IF NOT EXISTS mailing_address  TEXT,          -- billing / legal address
  ADD COLUMN IF NOT EXISTS website          TEXT,
  ADD COLUMN IF NOT EXISTS services         TEXT,          -- vendor services, e.g. "Cleaning, Plumbing"
  ADD COLUMN IF NOT EXISTS rating           NUMERIC(3,1),  -- internal vendor rating
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS status           TEXT,          -- lifecycle, e.g. "New Inquiry", "Current Tenant", "Past Client"
  -- tenant inquiry preferences
  ADD COLUMN IF NOT EXISTS min_bedrooms     SMALLINT,
  ADD COLUMN IF NOT EXISTS min_bathrooms    NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS min_parking      SMALLINT,
  ADD COLUMN IF NOT EXISTS pet_preference   TEXT,          -- e.g. "Cat Friendly", "None"
  ADD COLUMN IF NOT EXISTS move_in_date     DATE,
  ADD COLUMN IF NOT EXISTS lease_type       TEXT,          -- e.g. "Long Term (12+ months)"
  ADD COLUMN IF NOT EXISTS max_price        NUMERIC(10,2);

-- Widen the allowed role set: realtor, accountant, and a generic contact
-- for people who don't fit a portal role. The JWT auth hook is unchanged —
-- these roles simply have no staff/tenant/owner RLS grants.
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_role_valid;
ALTER TABLE public.people
  ADD CONSTRAINT people_role_valid CHECK (
    role && ARRAY['admin', 'manager', 'employee', 'tenant', 'owner', 'vendor', 'realtor', 'accountant', 'contact']::text[]
  );

-- Status is a frequent filter axis for the inquiry pipeline
CREATE INDEX IF NOT EXISTS people_org_status_idx ON public.people (org_id, status);
