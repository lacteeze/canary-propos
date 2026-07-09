import { createPublicClient } from '@/lib/supabase/public'
import { unstable_noStore as noStore } from 'next/cache'
import { getOrgBySlug } from '@/lib/orgs'
import {
  mapListingRow,
  type ListingRow,
} from '@/lib/listings/browse-utils'
import type { BrowseListing } from '@/lib/listings/browse-types'
import { getListingPhotoPathsByPropertyIds } from '@/lib/storage/property-listing-media'
import { signListingPhotoPaths } from '@/lib/storage/listing-photos'
import { CARD_PHOTOS } from '@/lib/landing/content'

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

  const rows = (listings ?? []) as ListingRow[]
  const propertyIds = rows
    .map((r) => r.units?.properties?.id)
    .filter((id): id is string => !!id)

  const pathsByProperty = await getListingPhotoPathsByPropertyIds(propertyIds)
  const coverPaths = rows.map((row, index) => {
    const propertyId = row.units?.properties?.id
    const fromMedia = propertyId ? pathsByProperty.get(propertyId)?.[0] : undefined
    const fromLegacy = row.units?.properties?.photo_paths?.[0]
    return fromMedia || fromLegacy || null
  })
  const signedCovers = await signListingPhotoPaths(coverPaths.map((p) => p ?? ''))

  const orgQuery = orgSlug ? `?org=${orgSlug}` : ''

  return rows.map((row, index) => {
    const signed = signedCovers[index]
    const mapped = mapListingRow(row, '', orgQuery, index)
    return {
      ...mapped,
      photo: signed || CARD_PHOTOS[index % CARD_PHOTOS.length],
    }
  })
}
