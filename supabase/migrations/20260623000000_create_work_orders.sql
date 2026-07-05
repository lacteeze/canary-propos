-- Migration: 20260623000000_create_work_orders
-- Purpose: Create work_orders table for Phase 5 maintenance management

-- Enums
CREATE TYPE work_order_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE work_order_status AS ENUM (
  'draft',
  'submitted',
  'assigned',
  'in_progress',
  'pending_approval',
  'approved',
  'completed',
  'closed'
);

-- Table
CREATE TABLE work_orders (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID          NOT NULL REFERENCES organizations(id),
  property_id         UUID          NOT NULL REFERENCES properties(id),
  unit_id             UUID          REFERENCES units(id),
  title               TEXT          NOT NULL,
  description         TEXT          NOT NULL,
  priority            work_order_priority NOT NULL DEFAULT 'medium',
  status              work_order_status   NOT NULL DEFAULT 'draft',
  assigned_vendor_id  UUID          REFERENCES people(id),
  vendor_token        UUID          UNIQUE DEFAULT gen_random_uuid(),
  estimated_cost      NUMERIC(10,2),
  vendor_cost         NUMERIC(10,2),
  billed_amount       NUMERIC(10,2),
  owner_decline_note  TEXT,
  owner_approve_token UUID          UNIQUE,
  owner_decline_token UUID          UNIQUE,
  created_by          UUID          NOT NULL REFERENCES people(id),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_work_orders_org_id         ON work_orders (org_id);
CREATE INDEX idx_work_orders_property_id    ON work_orders (property_id);
CREATE INDEX idx_work_orders_status         ON work_orders (status);
CREATE INDEX idx_work_orders_assigned_vendor ON work_orders (assigned_vendor_id);
CREATE INDEX idx_work_orders_vendor_token   ON work_orders (vendor_token);

-- RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Managers: full CRUD within their org
CREATE POLICY managers_full_crud ON work_orders
  FOR ALL
  TO authenticated
  USING (
    org_id = (SELECT org_id FROM people WHERE user_id = auth.uid() AND active = true)
    AND 'manager' = ANY(SELECT unnest(role) FROM people WHERE user_id = auth.uid() AND active = true)
  )
  WITH CHECK (
    org_id = (SELECT org_id FROM people WHERE user_id = auth.uid() AND active = true)
    AND 'manager' = ANY(SELECT unnest(role) FROM people WHERE user_id = auth.uid() AND active = true)
  );

-- Tenants: INSERT own work orders
CREATE POLICY tenants_insert ON work_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (SELECT org_id FROM people WHERE user_id = auth.uid() AND active = true)
    AND 'tenant' = ANY(SELECT unnest(role) FROM people WHERE user_id = auth.uid() AND active = true)
  );

-- Tenants: SELECT only their own work orders
CREATE POLICY tenants_select_own ON work_orders
  FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT id FROM people WHERE user_id = auth.uid() AND active = true)
  );
