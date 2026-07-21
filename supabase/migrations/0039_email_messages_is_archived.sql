-- Archive flag for PropOS Gmail inbox (hide from default views without losing category)
ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS email_messages_org_archived_idx
  ON public.email_messages (org_id, is_archived)
  WHERE is_archived = true;
