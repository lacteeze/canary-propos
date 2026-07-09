import { createPublicClient } from '@/lib/supabase/public'
import { getOrgBySlug } from '@/lib/orgs'
import { CARD_PHOTOS, type LandingListing } from './content'
import { deriveTermTypeFromHighlights } from './listing-term'
import { getListingPhotoPathsByPropertyIds } from '@/lib/storage/property-listing-media'
import { signListingPhotoPaths } from '@/lib/storage/listing-photos'

function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function shortAddress(address: string): string {
  return address.split(',')[0]?.trim() ?? address
}

export async function getFeaturedListings(
  orgSlug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? 'canary',
  limit = 6
): Promise<LandingListing[]> {
  const org = await getOrgBySlug(orgSlug)
  if (!org) return []

  const supabase = createPublicClient()
  const { data: listings } = await supabase
    .from('listings')
    .select(
      `id, listing_title, display_rent, highlights, available_from, status,
       units!unit_id(id, bedrooms, bathrooms, asking_rent, amenities,
         properties!property_id(id, street_address, city, province, photo_paths))`
    )
    .eq('status', 'published')
    .eq('org_id', org.id)
    .limit(limit)

  const rows = listings ?? []
  const propertyIds = rows
    .map((listing) => {
      const unit = listing.units as { properties?: { id?: string } | null } | null
      return unit?.properties?.id
    })
    .filter((id): id is string => !!id)

  const pathsByProperty = await getListingPhotoPathsByPropertyIds(propertyIds)
  const coverPaths = rows.map((listing) => {
    const unit = listing.units as {
      properties?: { id?: string; photo_paths?: string[] | null } | null
    } | null
    const property = unit?.properties
    const fromMedia = property?.id ? pathsByProperty.get(property.id)?.[0] : undefined
    return fromMedia || property?.photo_paths?.[0] || null
  })
  const signedCovers = await signListingPhotoPaths(coverPaths.map((p) => p ?? ''))
  const orgQuery = orgSlug ? `?org=${orgSlug}` : ''

  return rows.map((listing, index) => {
    const unit = listing.units as {
      bedrooms: number
      bathrooms: number
      asking_rent: number | null
      amenities: string[] | null
      properties: {
        street_address: string
        city: string
        photo_paths: string[] | null
      } | null
    } | null

    const property = unit?.properties
    const rentN = listing.display_rent ?? unit?.asking_rent ?? 0
    const address = property?.street_address ?? listing.listing_title
    const amenities = unit?.amenities?.join(' ') ?? ''
    const petFriendly = /pet|dog|cat|friendly/i.test(amenities)

    return {
      id: listing.id,
      short: shortAddress(address),
      rent: rentN ? formatCAD(rentN) : '—',
      rentN,
      beds: String(unit?.bedrooms ?? '—'),
      baths: String(unit?.bathrooms ?? '—').replace(/\.0$/, ''),
      extra: petFriendly ? '🐾 pet friendly' : (property?.city ?? ''),
      termType: deriveTermTypeFromHighlights(listing.highlights),
      photo: signedCovers[index] || CARD_PHOTOS[index % CARD_PHOTOS.length],
      href: `/listings/${listing.id}${orgQuery}`,
    }
  })
}
