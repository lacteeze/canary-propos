-- 0037_create_listing_alert_subscribers.sql
-- Landing-page "Notify me" / new-listing alert signups.
-- Anon INSERT only (same trust pattern as inquiries — org_id set by Server Action).

CREATE TABLE public.listing_alert_subscribers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  source      TEXT        NOT NULL DEFAULT 'landing_footer',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT listing_alert_subscribers_email_lower CHECK (email = lower(email)),
  CONSTRAINT listing_alert_subscribers_org_email_unique UNIQUE (org_id, email)
);

ALTER TABLE public.listing_alert_subscribers ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.listing_alert_subscribers (org_id);
CREATE INDEX ON public.listing_alert_subscribers (created_at DESC);

-- Staff: read subscribers in their org
CREATE POLICY "listing_alert_subscribers_select_staff"
ON public.listing_alert_subscribers
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- Anon: INSERT only — org_id integrity enforced in the Server Action
CREATE POLICY "listing_alert_subscribers_insert_anon"
ON public.listing_alert_subscribers
FOR INSERT
TO anon
WITH CHECK (true);
