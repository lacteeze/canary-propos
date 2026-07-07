-- 0024_create_audit_and_chat.sql
-- Audit log for entity field changes + property-scoped team chat and direct messages.

-- ============================================================
-- audit_log
-- ============================================================
CREATE TABLE public.audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  table_name  TEXT        NOT NULL,
  record_id   UUID        NOT NULL,
  field_name  TEXT        NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  changed_by  UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_record ON public.audit_log (table_name, record_id, changed_at DESC);
CREATE INDEX idx_audit_log_org     ON public.audit_log (org_id, changed_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_staff"
ON public.audit_log FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "audit_log_insert_staff"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- ============================================================
-- chat threads + messages
-- ============================================================
CREATE TYPE public.chat_thread_type AS ENUM ('property', 'direct');

CREATE TABLE public.chat_threads (
  id               UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID                    NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type             public.chat_thread_type NOT NULL,
  property_id      UUID                    REFERENCES public.properties(id) ON DELETE CASCADE,
  title            TEXT,
  last_message_at  TIMESTAMPTZ             NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ             NOT NULL DEFAULT now(),
  CONSTRAINT chat_threads_property_required CHECK (
    (type = 'property' AND property_id IS NOT NULL)
    OR (type = 'direct' AND property_id IS NULL)
  )
);

CREATE UNIQUE INDEX idx_chat_threads_property_unique
  ON public.chat_threads (org_id, property_id)
  WHERE type = 'property';

CREATE INDEX idx_chat_threads_org_last_message
  ON public.chat_threads (org_id, last_message_at DESC);

CREATE TABLE public.chat_thread_members (
  thread_id   UUID        NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  person_id   UUID        NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, person_id)
);

CREATE INDEX idx_chat_thread_members_person ON public.chat_thread_members (person_id);

CREATE TABLE public.chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID        NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES public.people(id) ON DELETE SET NULL,
  body        TEXT        NOT NULL CHECK (char_length(body) <= 10000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at   TIMESTAMPTZ
);

CREATE INDEX idx_chat_messages_thread ON public.chat_messages (thread_id, created_at ASC);

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Staff: read/write property threads in org
CREATE POLICY "chat_threads_select_staff_property"
ON public.chat_threads FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND type = 'property'
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "chat_threads_insert_staff_property"
ON public.chat_threads FOR INSERT TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND type = 'property'
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "chat_threads_update_staff_property"
ON public.chat_threads FOR UPDATE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND type = 'property'
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- Direct threads: members only
CREATE POLICY "chat_threads_select_dm_member"
ON public.chat_threads FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND type = 'direct'
  AND EXISTS (
    SELECT 1 FROM public.chat_thread_members m
    WHERE m.thread_id = chat_threads.id
      AND m.person_id = (SELECT public.person_id())
  )
);

CREATE POLICY "chat_threads_insert_dm"
ON public.chat_threads FOR INSERT TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND type = 'direct'
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "chat_threads_update_dm_member"
ON public.chat_threads FOR UPDATE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND type = 'direct'
  AND EXISTS (
    SELECT 1 FROM public.chat_thread_members m
    WHERE m.thread_id = chat_threads.id
      AND m.person_id = (SELECT public.person_id())
  )
);

-- thread members
CREATE POLICY "chat_thread_members_select"
ON public.chat_thread_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = chat_thread_members.thread_id
      AND t.org_id = (SELECT public.org_id())
      AND (
        (t.type = 'property' AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin'))
        OR (t.type = 'direct' AND EXISTS (
          SELECT 1 FROM public.chat_thread_members m2
          WHERE m2.thread_id = t.id AND m2.person_id = (SELECT public.person_id())
        ))
      )
  )
);

CREATE POLICY "chat_thread_members_insert"
ON public.chat_thread_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = chat_thread_members.thread_id
      AND t.org_id = (SELECT public.org_id())
      AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  )
);

-- messages
CREATE POLICY "chat_messages_select"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = chat_messages.thread_id
      AND t.org_id = (SELECT public.org_id())
      AND (
        (t.type = 'property' AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin'))
        OR (t.type = 'direct' AND EXISTS (
          SELECT 1 FROM public.chat_thread_members m
          WHERE m.thread_id = t.id AND m.person_id = (SELECT public.person_id())
        ))
      )
  )
);

CREATE POLICY "chat_messages_insert"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  author_id = (SELECT public.person_id())
  AND EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = chat_messages.thread_id
      AND t.org_id = (SELECT public.org_id())
      AND (
        (t.type = 'property' AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin'))
        OR (t.type = 'direct' AND EXISTS (
          SELECT 1 FROM public.chat_thread_members m
          WHERE m.thread_id = t.id AND m.person_id = (SELECT public.person_id())
        ))
      )
  )
);
