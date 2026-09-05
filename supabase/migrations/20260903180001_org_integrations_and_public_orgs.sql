-- B1: move Gmail/Drive/Tasks OAuth tokens off organizations.
-- Provider-row table. Composite PK (org_id, provider) so one org can connect all three.
-- Re-runnable on a clean DB and on a host that already has the wide org_integrations table.

CREATE TABLE IF NOT EXISTS public.org_integrations (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gmail', 'drive', 'tasks')),
  access_token text,
  refresh_token text,
  token_expiry bigint,
  connected_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, provider)
);

-- Reshape a previously applied wide org_integrations table (one row per org).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'org_integrations'
      AND column_name = 'gmail_refresh_token'
  ) THEN
    CREATE TABLE public.org_integrations_providers (
      org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      provider text NOT NULL CHECK (provider IN ('gmail', 'drive', 'tasks')),
      access_token text,
      refresh_token text,
      token_expiry bigint,
      connected_email text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (org_id, provider)
    );

    INSERT INTO public.org_integrations_providers
      (org_id, provider, access_token, refresh_token, token_expiry, updated_at)
    SELECT org_id, 'gmail', gmail_access_token, gmail_refresh_token, gmail_token_expiry, now()
    FROM public.org_integrations
    WHERE gmail_refresh_token IS NOT NULL OR gmail_access_token IS NOT NULL
    ON CONFLICT (org_id, provider) DO NOTHING;

    INSERT INTO public.org_integrations_providers
      (org_id, provider, access_token, refresh_token, token_expiry, updated_at)
    SELECT org_id, 'drive', drive_access_token, drive_refresh_token, drive_token_expiry, now()
    FROM public.org_integrations
    WHERE drive_refresh_token IS NOT NULL OR drive_access_token IS NOT NULL
    ON CONFLICT (org_id, provider) DO NOTHING;

    INSERT INTO public.org_integrations_providers
      (org_id, provider, access_token, refresh_token, token_expiry, updated_at)
    SELECT org_id, 'tasks', tasks_access_token, tasks_refresh_token, tasks_token_expiry, now()
    FROM public.org_integrations
    WHERE tasks_refresh_token IS NOT NULL OR tasks_access_token IS NOT NULL
    ON CONFLICT (org_id, provider) DO NOTHING;

    DROP TRIGGER IF EXISTS trg_ensure_org_integrations_row ON public.organizations;
    DROP FUNCTION IF EXISTS public.ensure_org_integrations_row();
    DROP TABLE public.org_integrations CASCADE;
    ALTER TABLE public.org_integrations_providers RENAME TO org_integrations;
  END IF;
END $$;

-- Copy tokens from organizations when those columns still exist (clean origin/main).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'gmail_refresh_token'
  ) THEN
    INSERT INTO public.org_integrations
      (org_id, provider, access_token, refresh_token, token_expiry, updated_at)
    SELECT id, 'gmail', gmail_access_token, gmail_refresh_token, gmail_token_expiry, now()
    FROM public.organizations
    WHERE gmail_refresh_token IS NOT NULL OR gmail_access_token IS NOT NULL
    ON CONFLICT (org_id, provider) DO NOTHING;

    INSERT INTO public.org_integrations
      (org_id, provider, access_token, refresh_token, token_expiry, updated_at)
    SELECT id, 'drive', drive_access_token, drive_refresh_token, drive_token_expiry, now()
    FROM public.organizations
    WHERE drive_refresh_token IS NOT NULL OR drive_access_token IS NOT NULL
    ON CONFLICT (org_id, provider) DO NOTHING;

    INSERT INTO public.org_integrations
      (org_id, provider, access_token, refresh_token, token_expiry, updated_at)
    SELECT id, 'tasks', tasks_access_token, tasks_refresh_token, tasks_token_expiry, now()
    FROM public.organizations
    WHERE tasks_refresh_token IS NOT NULL OR tasks_access_token IS NOT NULL
    ON CONFLICT (org_id, provider) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.organizations DROP COLUMN IF EXISTS gmail_access_token;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS gmail_refresh_token;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS gmail_token_expiry;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS drive_access_token;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS drive_refresh_token;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS drive_token_expiry;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS tasks_access_token;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS tasks_refresh_token;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS tasks_token_expiry;

ALTER TABLE public.org_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_integrations FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.org_integrations FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "orgs_select_anon" ON public.organizations;
REVOKE SELECT ON public.organizations FROM anon;

DROP VIEW IF EXISTS public.public_organizations;
CREATE VIEW public.public_organizations
  WITH (security_invoker = false)
AS
SELECT id, name, slug, logo_path, province
FROM public.organizations;

GRANT SELECT ON public.public_organizations TO anon, authenticated;
