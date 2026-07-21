-- 0038_create_email_messages.sql
-- PropOS Gmail inbox: synced messages + classification + org sync cursors

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS gmail_history_id text,
  ADD COLUMN IF NOT EXISTS gmail_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS gmail_last_sync_error text;

CREATE TYPE public.email_category AS ENUM (
  'spam',
  'tenant',
  'owner',
  'vendor',
  'invoice',
  'receipt',
  'etransfer',
  'maintenance',
  'internal',
  'other',
  'needs_review'
);

CREATE TYPE public.email_classified_by AS ENUM (
  'rule',
  'ai',
  'human',
  'pending'
);

CREATE TABLE public.email_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  gmail_message_id      TEXT NOT NULL,
  gmail_thread_id       TEXT,
  from_email            TEXT,
  from_name             TEXT,
  to_emails             TEXT[] NOT NULL DEFAULT '{}',
  cc_emails             TEXT[] NOT NULL DEFAULT '{}',
  subject               TEXT NOT NULL DEFAULT '',
  snippet               TEXT NOT NULL DEFAULT '',
  body_text             TEXT,
  received_at           TIMESTAMPTZ NOT NULL,
  is_unread             BOOLEAN NOT NULL DEFAULT true,
  gmail_label_ids       TEXT[] NOT NULL DEFAULT '{}',
  category              public.email_category NOT NULL DEFAULT 'needs_review',
  category_confidence   REAL,
  classified_by         public.email_classified_by NOT NULL DEFAULT 'pending',
  matched_person_id     UUID REFERENCES public.people(id) ON DELETE SET NULL,
  matched_property_id   UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  matched_unit_id       UUID REFERENCES public.units(id) ON DELETE SET NULL,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, gmail_message_id)
);

CREATE INDEX email_messages_org_received_idx
  ON public.email_messages (org_id, received_at DESC);
CREATE INDEX email_messages_org_category_idx
  ON public.email_messages (org_id, category);
CREATE INDEX email_messages_org_unread_idx
  ON public.email_messages (org_id, is_unread)
  WHERE is_unread = true;
CREATE INDEX email_messages_matched_person_idx
  ON public.email_messages (matched_person_id)
  WHERE matched_person_id IS NOT NULL;

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_messages_select_staff"
ON public.email_messages
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "email_messages_update_staff"
ON public.email_messages
FOR UPDATE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- Inserts/deletes happen via service role during sync (or authenticated staff with INSERT if needed)
CREATE POLICY "email_messages_insert_staff"
ON public.email_messages
FOR INSERT
TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);
