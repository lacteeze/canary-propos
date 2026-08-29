-- 0058_intake_submissions.sql
-- Staging table for the public org-scoped client intake form (/onboard).
-- Does NOT write to people / properties / units. Promotion is a later step.
--
-- Trust boundary:
--   Anon INSERT only (same pattern as inquiries / listing_alert_subscribers).
--   org_id is set by the Server Action from the onboard link (default org slug
--   or x-org-slug). Anon is NOT granted SELECT/UPDATE: a draft-only SELECT
--   policy would let anyone list every in-progress submission.
--   Resume / save / submit look up by token with the service-role client
--   (same pattern as vendor_token / owner approve).
--   Once status leaves 'draft', server actions refuse further anon writes.
--
-- Photo path convention (uploads land in a later step):
--   org-assets/{org_id}/intake/{token}/{filename}

-- ============================================================
-- intake_submissions
-- ============================================================
CREATE TABLE public.intake_submissions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token                  UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- denormalized for staff list view only
  contact_name           TEXT,
  contact_email          TEXT,
  property_address       TEXT,

  payload                JSONB       NOT NULL DEFAULT '{}'::jsonb,

  current_step           INTEGER     NOT NULL DEFAULT 1
                                       CHECK (current_step BETWEEN 1 AND 7),
  status                 TEXT        NOT NULL DEFAULT 'draft'
                                       CHECK (status IN ('draft', 'submitted', 'promoted', 'archived')),

  submitted_at           TIMESTAMPTZ,
  promoted_at            TIMESTAMPTZ,
  promoted_to_client_id  UUID,       -- future people.id (owner); no FK yet

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.intake_submissions (status);
CREATE INDEX ON public.intake_submissions (token);
CREATE INDEX ON public.intake_submissions (org_id);
CREATE INDEX ON public.intake_submissions (org_id, created_at DESC);

COMMENT ON TABLE public.intake_submissions IS
  'Public client-intake staging. Resume credential is token. Promotion is out of scope.';

COMMENT ON COLUMN public.intake_submissions.promoted_to_client_id IS
  'Nullable pointer to people.id after promotion. No FK until promotion ships.';

-- ============================================================
-- updated_at
-- ============================================================
CREATE TRIGGER intake_submissions_updated_at
BEFORE UPDATE ON public.intake_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Identity lock: org_id and token never change after insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.intake_submissions_protect_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.org_id IS DISTINCT FROM NEW.org_id
     OR OLD.token IS DISTINCT FROM NEW.token THEN
    RAISE EXCEPTION 'intake_submissions org_id and token are immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_intake_submissions_protect_identity
BEFORE UPDATE ON public.intake_submissions
FOR EACH ROW
EXECUTE FUNCTION public.intake_submissions_protect_identity();

-- ============================================================
-- RLS
-- Helpers wrapped in (SELECT ...) per Pitfall 2.
-- ============================================================

-- Anon: INSERT only. org_id integrity is enforced by the Server Action.
CREATE POLICY "intake_submissions_insert_anon"
ON public.intake_submissions
FOR INSERT
TO anon
WITH CHECK (true);

-- Staff (manager, employee, admin): read submissions in their org
CREATE POLICY "intake_submissions_select_staff"
ON public.intake_submissions
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- Platform admin: cross-org read (matches properties / units)
CREATE POLICY "intake_submissions_select_admin"
ON public.intake_submissions
FOR SELECT
TO authenticated
USING (
  (SELECT public.user_role()) = 'admin'
);

-- Manager/admin: status changes (submitted → archived, later promote)
CREATE POLICY "intake_submissions_update_staff"
ON public.intake_submissions
FOR UPDATE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- Anon: never DELETE. Staff: never DELETE (archive via status).
