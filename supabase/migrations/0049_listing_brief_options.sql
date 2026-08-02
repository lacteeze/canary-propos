-- Org-scoped learned dropdown options for listing quick fields.
CREATE TABLE IF NOT EXISTS public.listing_brief_options (
  org_id     UUID        PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  options    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.listing_brief_options IS
  'Per-org learned option lists for listing_brief quick fields (pets, utilities, etc.).';

ALTER TABLE public.listing_brief_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_brief_options_staff_all"
  ON public.listing_brief_options
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
