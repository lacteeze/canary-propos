-- Soft-delete + muted notification senders for PropOS inbox
ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS email_messages_org_deleted_idx
  ON public.email_messages (org_id, is_deleted)
  WHERE is_deleted = true;

CREATE TABLE IF NOT EXISTS public.email_muted_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS email_muted_senders_org_idx
  ON public.email_muted_senders (org_id);

ALTER TABLE public.email_muted_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_muted_senders_select_staff"
ON public.email_muted_senders FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "email_muted_senders_insert_staff"
ON public.email_muted_senders FOR INSERT TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "email_muted_senders_delete_staff"
ON public.email_muted_senders FOR DELETE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);
