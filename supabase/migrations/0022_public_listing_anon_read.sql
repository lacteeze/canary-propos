-- 0022_public_listing_anon_read.sql
-- Allow anonymous visitors to read org branding and listing-related property/unit
-- rows needed for public listing pages and the marketing landing page.
-- Listings themselves are already readable via listings_select_anon (0014).

-- Organizations: public name/slug for org resolution on marketing + listing pages
CREATE POLICY "orgs_select_anon"
ON public.organizations
FOR SELECT
TO anon
USING (true);

-- Properties: only those attached to a published listing
CREATE POLICY "properties_select_anon"
ON public.properties
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.listings l ON l.unit_id = u.id
    WHERE u.property_id = properties.id
      AND l.status = 'published'
  )
);

-- Units: only those with a published listing
CREATE POLICY "units_select_anon"
ON public.units
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.listings l
    WHERE l.unit_id = units.id
      AND l.status = 'published'
  )
);
