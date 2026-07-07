-- 0025_extend_work_orders_projects.sql
-- Extends work_orders so maintenance projects imported from the AppSheet
-- "Projects" tracker can be managed effectively.
--
-- Portfolio linkage is derived through property_id -> properties.portfolio_id
-- (every AppSheet project row is tied to a property, and portfolios hang off
-- properties), so no direct portfolio column is added.
--
-- New status values match AppSheet lifecycle states that the current enum
-- could not represent.
ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'postponed';
ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS category        TEXT,           -- type of work (AppSheet "Services", e.g. Roofing)
  ADD COLUMN IF NOT EXISTS budget          NUMERIC(12,2),  -- approved project budget (AppSheet "Budget")
  ADD COLUMN IF NOT EXISTS deposit         NUMERIC(10,2),  -- deposit collected/paid up front (AppSheet "Deposit")
  ADD COLUMN IF NOT EXISTS start_date      DATE,           -- work start (AppSheet "Start Date")
  ADD COLUMN IF NOT EXISTS end_date        DATE,           -- scheduled/actual end (AppSheet "End Date")
  ADD COLUMN IF NOT EXISTS completed_date  DATE,           -- when work was completed (AppSheet "Completed")
  ADD COLUMN IF NOT EXISTS notes           TEXT,           -- internal notes (AppSheet "Notes")
  ADD COLUMN IF NOT EXISTS external_ref    TEXT;           -- AppSheet "Project ID" for idempotent re-imports

-- One project per legacy AppSheet id per org (allows NULL for native projects).
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_org_external_ref
  ON public.work_orders (org_id, external_ref)
  WHERE external_ref IS NOT NULL;
