import { publicShareOrigin } from '@/lib/listings/public-share-metadata'
import { listingPublicHref } from '@/lib/listings/listing-href'
import type { ListingDetailListing } from '@/components/listings/ListingDetailView'

type PropertyType = string | null | undefined

function schemaTypeForProperty(propertyType: PropertyType): 'House' | 'Apartment' {
  if (propertyType === 'apartment_building' || propertyType === 'condo') return 'Apartment'
  return 'House'
}

export function listingOfferJsonLd(listing: ListingDetailListing, origin = publicShareOrigin()) {
  const unit = listing.units
  const property = unit?.properties
  const rent = listing.display_rent ?? unit?.asking_rent ?? null
  const path = listingPublicHref({ id: listing.id, slug: listing.slug }, '')
  const url = `${origin}${path}`
  const street = property?.street_address?.split(',')[0]?.trim() || listing.listing_title
  const propertyType =
    property && 'property_type' in property
      ? (property as { property_type?: string | null }).property_type
      : null

  return {
    '@context': 'https://schema.org',
    '@type': schemaTypeForProperty(propertyType),
    name: listing.listing_title,
    description: listing.listing_description ?? undefined,
    url,
    address: {
      '@type': 'PostalAddress',
      streetAddress: street,
      addressLocality: property?.city ?? "St. John's",
      addressRegion: property?.province ?? 'NL',
      addressCountry: 'CA',
    },
    numberOfRooms: unit?.bedrooms ?? undefined,
    numberOfBathroomsTotal: unit?.bathrooms ?? undefined,
    offers:
      rent != null
        ? {
            '@type': 'Offer',
            price: rent,
            priceCurrency: 'CAD',
            availability: 'https://schema.org/InStock',
            url,
          }
        : undefined,
  }
}
