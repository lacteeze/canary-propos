-- 0027_extend_leases_csv_fields.sql
-- Align leases table with CanaryApp / AppSheet CSV export columns for bulk import.
-- Adds lease-specific fields (utilities, insurance, credits, management window, AppSheet metadata).
-- Depends on: 0011_create_leases.sql

-- Month-to-month and open-ended leases may have no end date in the source CSV.
ALTER TABLE public.leases
  ALTER COLUMN end_date DROP NOT NULL;

ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS utilities_included        TEXT,
  ADD COLUMN IF NOT EXISTS management_start_date     DATE,
  ADD COLUMN IF NOT EXISTS management_end_date       DATE,
  ADD COLUMN IF NOT EXISTS management_fee_percent    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS rental_credit             NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rental_credit_expiry      DATE,
  ADD COLUMN IF NOT EXISTS days_occupied             INTEGER,
  ADD COLUMN IF NOT EXISTS insurance_details         TEXT,
  ADD COLUMN IF NOT EXISTS insurance_required        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS insurance_confirmed       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS policy_expires            DATE,
  ADD COLUMN IF NOT EXISTS termination_reason        TEXT,
  ADD COLUMN IF NOT EXISTS documents                 TEXT,
  ADD COLUMN IF NOT EXISTS notes                     TEXT,
  ADD COLUMN IF NOT EXISTS lease_months              INTEGER,
  ADD COLUMN IF NOT EXISTS appsheet_tenant_ids       TEXT[],
  ADD COLUMN IF NOT EXISTS appsheet_viewer_ids       TEXT[],
  ADD COLUMN IF NOT EXISTS tenant_contacts_raw       TEXT,
  ADD COLUMN IF NOT EXISTS appsheet_unique_id        TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_appsheet_id     TEXT,
  ADD COLUMN IF NOT EXISTS pets_policy               TEXT,
  ADD COLUMN IF NOT EXISTS leasing_fee_percent       NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS appsheet_created_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS appsheet_modified_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bedrooms                  SMALLINT,
  ADD COLUMN IF NOT EXISTS bathrooms                 NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS parking_spots             SMALLINT,
  ADD COLUMN IF NOT EXISTS folder_id                 TEXT,
  ADD COLUMN IF NOT EXISTS previous_lease_appsheet_id TEXT,
  ADD COLUMN IF NOT EXISTS previous_lease_id         UUID REFERENCES public.leases(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leases.utilities_included IS 'CSV Utilities — e.g. Not Included, Internet Included';
COMMENT ON COLUMN public.leases.rental_credit IS 'CSV Rental Credit — dollar amount credited against rent';
COMMENT ON COLUMN public.leases.rental_credit_expiry IS 'CSV Credit Expiry Date';
COMMENT ON COLUMN public.leases.tenant_contacts_raw IS 'CSV Editors — Name: phone: email strings for import resolution';
COMMENT ON COLUMN public.leases.appsheet_unique_id IS 'CSV Unique ID — AppSheet row key for idempotent import';
COMMENT ON COLUMN public.leases.appsheet_tenant_ids IS 'CSV Tenants — AppSheet person row IDs (co-tenants)';
COMMENT ON COLUMN public.leases.appsheet_viewer_ids IS 'CSV Viewers — internal AppSheet access list';

CREATE UNIQUE INDEX IF NOT EXISTS leases_org_appsheet_unique_id_uidx
  ON public.leases (org_id, appsheet_unique_id)
  WHERE appsheet_unique_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS leases_previous_lease_id_idx
  ON public.leases (previous_lease_id)
  WHERE previous_lease_id IS NOT NULL;
