-- 0048_billing_ai_listing_kb.sql
-- Listing brief fields, property knowledge base, charges ledger, period closings, Hospitable stays.

-- ============================================================
-- Property listing brief (AI / quick form inputs)
-- ============================================================
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS listing_brief JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.properties.listing_brief IS
  'Quick listing inputs for AI descriptions: pets, utilities, parking, laundry, furnished, neighborhood, features, targetTenant';

-- ============================================================
-- Property markdown knowledge base
-- ============================================================
CREATE TABLE IF NOT EXISTS public.property_knowledge_base (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id UUID        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  markdown    TEXT        NOT NULL DEFAULT '',
  updated_by  UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);

CREATE INDEX IF NOT EXISTS property_knowledge_base_org_idx
  ON public.property_knowledge_base (org_id);

ALTER TABLE public.property_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_kb_staff_all"
  ON public.property_knowledge_base
  FOR ALL
  TO authenticated
  USING (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  )
  WITH CHECK (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  );

-- ============================================================
-- Charges ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS public.charges (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lease_id      UUID          REFERENCES public.leases(id) ON DELETE RESTRICT,
  property_id   UUID          REFERENCES public.properties(id) ON DELETE RESTRICT,
  portfolio_id  UUID          REFERENCES public.portfolios(id) ON DELETE SET NULL,
  project_id    UUID          REFERENCES public.work_orders(id) ON DELETE SET NULL,
  type          TEXT          NOT NULL
                              CHECK (type IN ('rent', 'fee', 'adjustment', 'str_cleaning', 'str_mgmt', 'other')),
  amount        NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  amount_paid   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  due_date      DATE          NOT NULL,
  period_year   SMALLINT      NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month  SMALLINT      NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status        TEXT          NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'partial', 'paid', 'void')),
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT charges_amount_paid_lte_amount CHECK (amount_paid <= amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS charges_rent_lease_period_uidx
  ON public.charges (lease_id, period_year, period_month)
  WHERE type = 'rent' AND status <> 'void' AND lease_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS charges_org_idx ON public.charges (org_id);
CREATE INDEX IF NOT EXISTS charges_lease_status_idx ON public.charges (lease_id, status);
CREATE INDEX IF NOT EXISTS charges_property_period_idx
  ON public.charges (property_id, period_year, period_month);

ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charges_staff_all"
  ON public.charges
  FOR ALL
  TO authenticated
  USING (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  )
  WITH CHECK (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  );

CREATE POLICY "charges_tenant_select"
  ON public.charges
  FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) = 'tenant'
    AND lease_id IN (
      SELECT id FROM public.leases
      WHERE tenant_id = (SELECT public.person_id())
    )
  );

-- ============================================================
-- Payment allocations (FIFO apply)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_id  UUID          NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  charge_id   UUID          NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_allocations_payment_idx ON public.payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS payment_allocations_charge_idx ON public.payment_allocations (charge_id);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_allocations_staff_all"
  ON public.payment_allocations
  FOR ALL
  TO authenticated
  USING (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  )
  WITH CHECK (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  );

-- ============================================================
-- Period closings (portfolio month close)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.period_closings (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  portfolio_id       UUID          NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  period_year        SMALLINT      NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month       SMALLINT      NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status             TEXT          NOT NULL DEFAULT 'closed'
                                   CHECK (status IN ('open', 'closed')),
  net_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  direction          TEXT          NOT NULL CHECK (direction IN ('disburse', 'collect')),
  statement_pdf_path TEXT,
  closed_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  closed_by          UUID          REFERENCES public.people(id) ON DELETE SET NULL,
  notes              TEXT,
  UNIQUE (portfolio_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS period_closings_org_idx ON public.period_closings (org_id);

ALTER TABLE public.period_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "period_closings_staff_all"
  ON public.period_closings
  FOR ALL
  TO authenticated
  USING (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  )
  WITH CHECK (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  );

-- ============================================================
-- Hospitable stays (STR revenue import)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hospitable_stays (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id       UUID          REFERENCES public.properties(id) ON DELETE SET NULL,
  portfolio_id      UUID          REFERENCES public.portfolios(id) ON DELETE SET NULL,
  reservation_code  TEXT          NOT NULL,
  guest_name        TEXT,
  check_in          DATE,
  check_out         DATE,
  nights            INTEGER,
  gross_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  cleaning_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  management_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_to_owner      NUMERIC(10,2) NOT NULL DEFAULT 0,
  period_year       SMALLINT,
  period_month      SMALLINT,
  raw               JSONB,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (org_id, reservation_code)
);

CREATE INDEX IF NOT EXISTS hospitable_stays_property_period_idx
  ON public.hospitable_stays (property_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS hospitable_stays_portfolio_period_idx
  ON public.hospitable_stays (portfolio_id, period_year, period_month);

ALTER TABLE public.hospitable_stays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospitable_stays_staff_all"
  ON public.hospitable_stays
  FOR ALL
  TO authenticated
  USING (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  )
  WITH CHECK (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  );

-- Optional property link on payments for non-lease / STR cash
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_property_id_idx
  ON public.payments (property_id)
  WHERE property_id IS NOT NULL;

-- Link expenses to projects (work orders) for project balances
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expenses_work_order_id_idx
  ON public.expenses (work_order_id)
  WHERE work_order_id IS NOT NULL;
