-- 0010_extend_units.sql
-- Extends the existing units table with Phase 2 columns.
-- Depends on: 0008_create_properties.sql (properties table must exist for property_id FK).
-- The plan-limit trigger (trg_enforce_plan_unit_limit) fires BEFORE INSERT — unaffected by ALTER TABLE ADD COLUMN.
-- Existing RLS policies from 0007 remain valid (scope by org_id).
-- Phase 2 does NOT add tenant SELECT to units — tenants access unit info only through lease queries.

-- ============================================================
-- Add Phase 2 columns to units (all use IF NOT EXISTS — idempotent)
-- ============================================================
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS property_id   UUID          REFERENCES public.properties(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS unit_number   TEXT,
  ADD COLUMN IF NOT EXISTS floor         INTEGER,
  ADD COLUMN IF NOT EXISTS bedrooms      INTEGER       NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bathrooms     NUMERIC(3,1)  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sq_footage    INTEGER,
  ADD COLUMN IF NOT EXISTS status        TEXT          NOT NULL DEFAULT 'vacant'
                                           CHECK (status IN ('vacant', 'occupied', 'maintenance')),
  ADD COLUMN IF NOT EXISTS asking_rent   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS amenities     TEXT[],
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ   DEFAULT now();

-- Drop the old generic label column (stub with no production data)
-- Safe: schema has not been pushed to production with real unit data.
ALTER TABLE public.units DROP COLUMN IF EXISTS label;

-- ============================================================
-- Indexes for Phase 2 query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS units_property_id_idx ON public.units (property_id);
CREATE INDEX IF NOT EXISTS units_status_idx ON public.units (org_id, status);
