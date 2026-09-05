-- Migration: 20260623000000_create_work_orders
-- Purpose: Create work_orders table for Phase 5 maintenance management.
-- Idempotent: 0025_create_work_orders.sql now creates the table first so 0034/0035
-- can run on a fresh `supabase start`. Production already applied this file.

DO $$ BEGIN
  CREATE TYPE work_order_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
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
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.work_orders (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID          NOT NULL REFERENCES public.organizations(id),
  property_id         UUID          NOT NULL REFERENCES public.properties(id),
  unit_id             UUID          REFERENCES public.units(id),
  title               TEXT          NOT NULL,
  description         TEXT          NOT NULL,
  priority            work_order_priority NOT NULL DEFAULT 'medium',
  status              work_order_status   NOT NULL DEFAULT 'draft',
  assigned_vendor_id  UUID          REFERENCES public.people(id),
  vendor_token        UUID          UNIQUE DEFAULT gen_random_uuid(),
  estimated_cost      NUMERIC(10,2),
  vendor_cost         NUMERIC(10,2),
  billed_amount       NUMERIC(10,2),
  owner_decline_note  TEXT,
  owner_approve_token UUID          UNIQUE,
  owner_decline_token UUID          UNIQUE,
  created_by          UUID          NOT NULL REFERENCES public.people(id),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_orders_org_id ON public.work_orders (org_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_property_id ON public.work_orders (property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON public.work_orders (status);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_vendor ON public.work_orders (assigned_vendor_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_vendor_token ON public.work_orders (vendor_token);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS managers_full_crud ON public.work_orders;
CREATE POLICY managers_full_crud ON public.work_orders
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

DROP POLICY IF EXISTS tenants_insert ON public.work_orders;
CREATE POLICY tenants_insert ON public.work_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (SELECT org_id FROM people WHERE user_id = auth.uid() AND active = true)
    AND 'tenant' = ANY(SELECT unnest(role) FROM people WHERE user_id = auth.uid() AND active = true)
  );

-- Do not recreate tenants_select_own: 0053/0054 replace it. Only add if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_orders'
      AND policyname = 'tenants_select_own'
  ) THEN
    CREATE POLICY tenants_select_own ON public.work_orders
      FOR SELECT
      TO authenticated
      USING (
        created_by = (SELECT id FROM people WHERE user_id = auth.uid() AND active = true)
      );
  END IF;
END $$;
