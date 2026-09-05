import type { BrowseListing } from '@/lib/listings/browse-types'
import { listingMatchesCitySlug } from './city'
import { resolveNeighborhood } from './neighborhoods'
import type { ListingGroupMatch } from './types'

export const APARTMENT_TYPES = ['apartment_building', 'condo'] as const
export const HOUSE_TYPES = ['house', 'duplex', 'townhouse'] as const

export function listingMatchesBeds(listing: BrowseListing, min: number, max?: number): boolean {
  if (max == null) return listing.beds >= min
  return listing.beds >= min && listing.beds <= max
}

export function listingMatchesType(
  listing: BrowseListing,
  types: readonly string[],
): boolean {
  const type = listing.propertyType ?? ''
  return types.includes(type)
}

export function listingsForMatch(
  listings: BrowseListing[],
  match: ListingGroupMatch,
): BrowseListing[] {
  switch (match.kind) {
    case 'all':
      return listings
    case 'city':
      return listings.filter((listing) =>
        listingMatchesCitySlug(listing.city, match.citySlug, listing.streetAddress),
      )
    case 'neighborhood':
      return listings.filter(
        (listing) =>
          listingMatchesCitySlug(listing.city, match.citySlug, listing.streetAddress) &&
          resolveNeighborhood(listing) === match.neighborhood,
      )
    case 'beds':
      return listings.filter((listing) => listingMatchesBeds(listing, match.min, match.max))
    case 'type':
      return listings.filter((listing) => listingMatchesType(listing, match.types))
    case 'amenity':
      return listings.filter((listing) => listing.petFriendly)
    case 'city-beds':
      return listings.filter(
        (listing) =>
          listingMatchesCitySlug(listing.city, match.citySlug, listing.streetAddress) &&
          listingMatchesBeds(listing, match.min, match.max),
      )
  }
}

