-- 0020_alter_properties_fees.sql
-- Phase 4: Add management fee configuration columns to properties
-- Both columns nullable — existing properties have no fee configured (treated as 0 fee per D-05)

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS management_fee_type  text
    CHECK (management_fee_type IN ('percent', 'flat')),
  ADD COLUMN IF NOT EXISTS management_fee_value numeric(10,2);
