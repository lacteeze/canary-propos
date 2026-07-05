-- 0002_create_people.sql
-- Creates the people table — maps auth users to orgs with roles.
-- user_id is nullable until the invited person completes sign-up.
-- invite_token is used in the invite URL (ORGS-01, D-07).
-- RLS enabled here; policies added in 0005_rls_people.sql.

CREATE TABLE public.people (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,  -- null until invite accepted
  org_id              UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role                TEXT        NOT NULL
                                   CHECK (role IN ('admin', 'manager', 'employee', 'tenant', 'owner', 'vendor')),
  email               TEXT        NOT NULL,
  first_name          TEXT,
  last_name           TEXT,
  phone               TEXT,
  invite_token        UUID        UNIQUE DEFAULT gen_random_uuid(),  -- used in invite link (ORGS-01)
  invite_sent_at      TIMESTAMPTZ,
  invite_accepted_at  TIMESTAMPTZ,  -- null until user completes sign-up (D-09)
  active              BOOLEAN     NOT NULL DEFAULT true,
  deactivated_at      TIMESTAMPTZ,  -- set when manager removes user (ORGS-03, D-11)
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- RLS enabled here; policies are in 0005_rls_people.sql
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- Performance indexes — org_id and user_id are the primary query axes for RLS
CREATE INDEX ON public.people (org_id);
CREATE INDEX ON public.people (user_id);
CREATE INDEX ON public.people (invite_token);
