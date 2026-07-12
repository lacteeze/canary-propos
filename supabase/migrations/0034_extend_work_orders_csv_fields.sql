-- 0034_extend_work_orders_csv_fields.sql
-- Align work_orders with CanaryApp / AppSheet Projects CSV export columns.
-- Depends on: 20260623000000_create_work_orders.sql

ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'postponed';
ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS start_date              DATE,
  ADD COLUMN IF NOT EXISTS end_date                DATE,
  ADD COLUMN IF NOT EXISTS completed_date          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes                   TEXT,
  ADD COLUMN IF NOT EXISTS deposit                 NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS budget                  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS priority_number         SMALLINT,
  ADD COLUMN IF NOT EXISTS fire_risk               SMALLINT CHECK (fire_risk IS NULL OR (fire_risk >= 0 AND fire_risk <= 5)),
  ADD COLUMN IF NOT EXISTS water_damage_risk       SMALLINT CHECK (water_damage_risk IS NULL OR (water_damage_risk >= 0 AND water_damage_risk <= 5)),
  ADD COLUMN IF NOT EXISTS loss_of_rent_risk       SMALLINT CHECK (loss_of_rent_risk IS NULL OR (loss_of_rent_risk >= 0 AND loss_of_rent_risk <= 5)),
  ADD COLUMN IF NOT EXISTS liability_risk          SMALLINT CHECK (liability_risk IS NULL OR (liability_risk >= 0 AND liability_risk <= 5)),
  ADD COLUMN IF NOT EXISTS services                TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_appsheet_id   TEXT,
  ADD COLUMN IF NOT EXISTS appsheet_unique_id      TEXT,
  ADD COLUMN IF NOT EXISTS sub_project_id          TEXT,
  ADD COLUMN IF NOT EXISTS appsheet_created_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS appsheet_modified_at    TIMESTAMPTZ;

COMMENT ON COLUMN public.work_orders.appsheet_unique_id IS 'CSV Project ID — AppSheet row key for idempotent import';
COMMENT ON COLUMN public.work_orders.priority_number IS 'CSV Priority Number — sort rank from AppSheet';

CREATE UNIQUE INDEX IF NOT EXISTS work_orders_org_appsheet_unique_id_uidx
  ON public.work_orders (org_id, appsheet_unique_id)
  WHERE appsheet_unique_id IS NOT NULL;
