-- Create work_orders before 0034/0035, which previously ran before
-- 20260623000000_create_work_orders (timestamp sorts after 0034).
-- Idempotent: production already has the table from 20260623000000.

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
