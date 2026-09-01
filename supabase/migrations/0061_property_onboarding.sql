-- 0061_property_onboarding.sql
-- Staff property setup queue (Airbnb-style resume). One row per property.
-- Completeness is derived in app code; this table stores path, step, and
-- whether the details step was actually saved (factory 1 bed / 1 bath is not enough).

CREATE TABLE public.property_onboarding (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id            UUID        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  path                   TEXT        CHECK (path IS NULL OR path IN ('vacant', 'occupied')),
  current_step           TEXT        NOT NULL DEFAULT 'path'
                                       CHECK (current_step IN ('path', 'details', 'photos', 'listing', 'lease')),
  details_completed_at   TIMESTAMPTZ,
  completed_at           TIMESTAMPTZ,
  created_by             UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);

COMMENT ON TABLE public.property_onboarding IS
  'In-progress staff setup for a newly added property. Hidden from Needs setup when completed_at is set.';

CREATE INDEX property_onboarding_org_incomplete_idx
  ON public.property_onboarding (org_id, updated_at DESC)
  WHERE completed_at IS NULL;

ALTER TABLE public.property_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_onboarding_select_staff
ON public.property_onboarding
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY property_onboarding_insert_manager
ON public.property_onboarding
FOR INSERT
TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE POLICY property_onboarding_update_manager
ON public.property_onboarding
FOR UPDATE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE POLICY property_onboarding_delete_manager
ON public.property_onboarding
FOR DELETE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE TRIGGER property_onboarding_updated_at
BEFORE UPDATE ON public.property_onboarding
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.start_property_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.property_onboarding (org_id, property_id, current_step, created_by)
  VALUES (NEW.org_id, NEW.id, 'path', public.person_id())
  ON CONFLICT (property_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER properties_start_onboarding
AFTER INSERT ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.start_property_onboarding();

-- Today's orphan adds that already exist without an onboarding row.
INSERT INTO public.property_onboarding (org_id, property_id, current_step)
SELECT p.org_id, p.id, 'path'
FROM public.properties p
WHERE p.id IN (
  'f9ae7804-a859-4c38-ad02-ba81d01a5ae0',
  '25067f8c-5be5-465b-a7c5-8a7828f4f812',
  'f3a79385-3b11-4b93-a8dc-7add4ca0f49e'
)
ON CONFLICT (property_id) DO NOTHING;
