-- 0001_create_organizations.sql
-- Creates the organizations table — the root tenant unit.
-- province is NOT NULL per D-01 (Canadian compliance, M2).
-- plan_unit_limit enforced at DB layer via trigger in 0007.
-- RLS enabled here; policies added in 0004_rls_organizations.sql.

CREATE TABLE public.organizations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL CHECK (length(name) >= 2 AND length(name) <= 80),
  slug                TEXT        UNIQUE NOT NULL,
  province            TEXT        NOT NULL,  -- required (D-01); drives Canadian compliance (M2)
  logo_path           TEXT,                  -- Supabase Storage path, nullable
  plan_type           TEXT        NOT NULL DEFAULT 'free'
                                   CHECK (plan_type IN ('free', 'starter', 'growth')),
  plan_unit_limit     INTEGER     NOT NULL DEFAULT 5,   -- ORGS-05: free = 5 units
  stripe_customer_id  TEXT,
  setup_completed_at  TIMESTAMPTZ,           -- null until onboarding wizard fully complete (D-02)
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- RLS enabled here; policies are in 0004_rls_organizations.sql
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Index on primary key (explicit; helps query planner with UUID PKs)
CREATE INDEX ON public.organizations (id);
