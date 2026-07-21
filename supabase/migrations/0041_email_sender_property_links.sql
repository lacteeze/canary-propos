-- Map known inbox senders → property (and optional unit) for PropOS email tagging
CREATE TABLE IF NOT EXISTS public.email_sender_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS email_sender_links_org_idx
  ON public.email_sender_links (org_id);

ALTER TABLE public.email_sender_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_sender_links_select_staff"
ON public.email_sender_links FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "email_sender_links_insert_staff"
ON public.email_sender_links FOR INSERT TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "email_sender_links_update_staff"
ON public.email_sender_links FOR UPDATE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "email_sender_links_delete_staff"
ON public.email_sender_links FOR DELETE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);
