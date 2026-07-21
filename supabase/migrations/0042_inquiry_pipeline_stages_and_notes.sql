-- Expand inquiry pipeline statuses + staff activity notes
ALTER TYPE public.inquiry_status ADD VALUE IF NOT EXISTS 'application_sent';
ALTER TYPE public.inquiry_status ADD VALUE IF NOT EXISTS 'signed';

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.inquiry_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  inquiry_id  UUID NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES public.people(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inquiry_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS inquiry_notes_inquiry_id_idx ON public.inquiry_notes (inquiry_id);
CREATE INDEX IF NOT EXISTS inquiry_notes_org_id_idx ON public.inquiry_notes (org_id);

DROP POLICY IF EXISTS "inquiry_notes_select_staff" ON public.inquiry_notes;
CREATE POLICY "inquiry_notes_select_staff"
ON public.inquiry_notes
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

DROP POLICY IF EXISTS "inquiry_notes_insert_staff" ON public.inquiry_notes;
CREATE POLICY "inquiry_notes_insert_staff"
ON public.inquiry_notes
FOR INSERT
TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);
