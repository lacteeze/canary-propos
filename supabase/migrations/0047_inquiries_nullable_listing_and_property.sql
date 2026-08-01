-- Allow general-interest inquiries from leased/property pages without a published listing.
-- Prefer linking listing_id when any unit listing exists; otherwise property_id carries context.

ALTER TABLE public.inquiries
  ALTER COLUMN listing_id DROP NOT NULL;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inquiries_property_id_idx ON public.inquiries (property_id);
