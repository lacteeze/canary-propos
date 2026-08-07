-- Add Viewing pipeline stage + optional viewing datetime; allow managers to delete inquiries.

ALTER TYPE public.inquiry_status ADD VALUE IF NOT EXISTS 'viewing' AFTER 'contacted';

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS viewing_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.inquiries.viewing_at IS
  'Scheduled viewing datetime when status is viewing (optional).';

DROP POLICY IF EXISTS "inquiries_delete_manager" ON public.inquiries;
CREATE POLICY "inquiries_delete_manager"
ON public.inquiries
FOR DELETE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);
