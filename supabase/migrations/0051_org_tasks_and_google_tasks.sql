-- 0051_org_tasks_and_google_tasks.sql
-- Team/org tasks board + Google Tasks OAuth tokens on organizations.

-- Organizations: Google Tasks OAuth (mirror Drive columns)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tasks_access_token   text,
  ADD COLUMN IF NOT EXISTS tasks_refresh_token  text,
  ADD COLUMN IF NOT EXISTS tasks_token_expiry   bigint,
  ADD COLUMN IF NOT EXISTS tasks_connected_at   timestamptz;

COMMENT ON COLUMN public.organizations.tasks_access_token IS
  'Google Tasks OAuth access token (server-only; never expose to client).';
COMMENT ON COLUMN public.organizations.tasks_refresh_token IS
  'Google Tasks OAuth refresh token (server-only).';
COMMENT ON COLUMN public.organizations.tasks_token_expiry IS
  'Unix epoch milliseconds when tasks_access_token expires.';
COMMENT ON COLUMN public.organizations.tasks_connected_at IS
  'When Google Tasks was last successfully connected for this org.';

-- Enums
DO $$ BEGIN
  CREATE TYPE public.org_task_status AS ENUM ('todo', 'doing', 'done');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.org_task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.org_task_source AS ENUM ('manual', 'google');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.org_task_visibility AS ENUM ('org', 'assignees');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.org_tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text,
  status              public.org_task_status NOT NULL DEFAULT 'todo',
  priority            public.org_task_priority NOT NULL DEFAULT 'medium',
  due_date            date,
  assignee_person_id  uuid REFERENCES public.people(id) ON DELETE SET NULL,
  created_by          uuid NOT NULL REFERENCES public.people(id),
  property_id         uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  project_id          uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  visibility          public.org_task_visibility NOT NULL DEFAULT 'org',
  source              public.org_task_source NOT NULL DEFAULT 'manual',
  google_task_id      text,
  google_tasklist_id  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.org_tasks IS
  'Internal team tasks for Canary Tasks board (manual + imported Google Tasks).';

CREATE INDEX IF NOT EXISTS org_tasks_org_id_idx
  ON public.org_tasks (org_id);
CREATE INDEX IF NOT EXISTS org_tasks_assignee_idx
  ON public.org_tasks (org_id, assignee_person_id)
  WHERE assignee_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS org_tasks_status_idx
  ON public.org_tasks (org_id, status);
CREATE INDEX IF NOT EXISTS org_tasks_due_date_idx
  ON public.org_tasks (org_id, due_date)
  WHERE due_date IS NOT NULL;

-- One Google task per org when imported
CREATE UNIQUE INDEX IF NOT EXISTS org_tasks_org_google_task_id_uidx
  ON public.org_tasks (org_id, google_task_id)
  WHERE google_task_id IS NOT NULL;

ALTER TABLE public.org_tasks ENABLE ROW LEVEL SECURITY;

-- Staff (manager / employee / admin): full CRUD in org
DROP POLICY IF EXISTS org_tasks_staff_all ON public.org_tasks;
CREATE POLICY org_tasks_staff_all ON public.org_tasks
  FOR ALL
  TO authenticated
  USING (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  )
  WITH CHECK (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
  );

-- Assignees (incl. vendors/owners): read tasks shared/assigned to them
DROP POLICY IF EXISTS org_tasks_assignee_select ON public.org_tasks;
CREATE POLICY org_tasks_assignee_select ON public.org_tasks
  FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT public.org_id())
    AND assignee_person_id = (SELECT public.person_id())
  );

-- Assignees: update status/priority/notes on their assigned tasks (complete their work)
DROP POLICY IF EXISTS org_tasks_assignee_update ON public.org_tasks;
CREATE POLICY org_tasks_assignee_update ON public.org_tasks
  FOR UPDATE
  TO authenticated
  USING (
    org_id = (SELECT public.org_id())
    AND assignee_person_id = (SELECT public.person_id())
  )
  WITH CHECK (
    org_id = (SELECT public.org_id())
    AND assignee_person_id = (SELECT public.person_id())
  );

-- Creators who are not staff still see tasks they created
DROP POLICY IF EXISTS org_tasks_creator_select ON public.org_tasks;
CREATE POLICY org_tasks_creator_select ON public.org_tasks
  FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT public.org_id())
    AND created_by = (SELECT public.person_id())
  );
