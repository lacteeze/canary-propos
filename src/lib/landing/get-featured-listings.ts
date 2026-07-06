import { createPublicClient } from '@/lib/supabase/public'
import { getOrgBySlug } from '@/lib/orgs'
import { CARD_PHOTOS, type LandingListing } from './content'
import { deriveTermTypeFromHighlights } from './listing-term'

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

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/org-assets`
  const orgQuery = orgSlug ? `?org=${orgSlug}` : ''

  return (listings ?? []).map((listing, index) => {
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

    const photoFromStorage = property?.photo_paths?.[0]
      ? `${storageBase}/${property.photo_paths[0]}`
      : CARD_PHOTOS[index % CARD_PHOTOS.length]

    return {
      id: listing.id,
      short: shortAddress(address),
      rent: rentN ? formatCAD(rentN) : '—',
      rentN,
      beds: String(unit?.bedrooms ?? '—'),
      baths: String(unit?.bathrooms ?? '—').replace(/\.0$/, ''),
      extra: petFriendly ? '🐾 pet friendly' : (property?.city ?? ''),
      termType: deriveTermTypeFromHighlights(listing.highlights),
      photo: photoFromStorage,
      href: `/listings/${listing.id}${orgQuery}`,
    }
  })
}
