-- 0035_drop_work_orders_detail_columns.sql
-- Remove granular cost / billing columns from work_orders (not shown in Projects UI).

ALTER TABLE public.work_orders
  DROP COLUMN IF EXISTS cost_total,
  DROP COLUMN IF EXISTS labour_cost,
  DROP COLUMN IF EXISTS supplies_cost,
  DROP COLUMN IF EXISTS other_cost,
  DROP COLUMN IF EXISTS adjustments,
  DROP COLUMN IF EXISTS actual_cost,
  DROP COLUMN IF EXISTS collected_amount,
  DROP COLUMN IF EXISTS owing_amount,
  DROP COLUMN IF EXISTS over_under_amount,
  DROP COLUMN IF EXISTS profit_amount,
  DROP COLUMN IF EXISTS hours,
  DROP COLUMN IF EXISTS weeks,
  DROP COLUMN IF EXISTS margin_percent,
  DROP COLUMN IF EXISTS hst_amount,
  DROP COLUMN IF EXISTS external_link,
  DROP COLUMN IF EXISTS folder_id,
  DROP COLUMN IF EXISTS source_role,
  DROP COLUMN IF EXISTS contractors_raw,
  DROP COLUMN IF EXISTS clients_raw,
  DROP COLUMN IF EXISTS tenants_raw,
  DROP COLUMN IF EXISTS viewers_raw,
  DROP COLUMN IF EXISTS editors_raw;
