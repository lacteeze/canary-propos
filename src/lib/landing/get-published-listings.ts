import { createPublicClient } from '@/lib/supabase/public'
import { unstable_noStore as noStore } from 'next/cache'
import { getOrgBySlug } from '@/lib/orgs'
import {
  mapListingRow,
  type ListingRow,
} from '@/lib/listings/browse-utils'
import type { BrowseListing } from '@/lib/listings/browse-types'

export async function getPublishedListings(
  orgSlug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? 'canary'
): Promise<BrowseListing[]> {
  noStore()
  const org = await getOrgBySlug(orgSlug)
  if (!org) return []

  const supabase = createPublicClient()
  const { data: listings } = await supabase
    .from('listings')
    .select(
      `id, listing_title, listing_description, display_rent, highlights, available_from, status, created_at,
       units!unit_id(id, bedrooms, bathrooms, asking_rent, amenities,
         properties!property_id(id, street_address, city, province, photo_paths))`
    )
    .eq('status', 'published')
    .eq('org_id', org.id)

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/org-assets`
  const orgQuery = orgSlug ? `?org=${orgSlug}` : ''

  return (listings ?? []).map((row, index) =>
    mapListingRow(row as ListingRow, storageBase, orgQuery, index)
  )
}
