import { publicShareOrigin } from '@/lib/listings/public-share-metadata'
import type { BrowseListing } from '@/lib/listings/browse-types'
import { rentalsHref, type ListingGroupDef, type ListingGroupInventory } from './types'

export function listingGroupJsonLd(
  group: ListingGroupDef,
  inventory: ListingGroupInventory,
  origin = publicShareOrigin(),
) {
  const pageUrl = `${origin}${rentalsHref(group.path)}`
  const itemList = {
    '@type': 'ItemList',
    name: group.h1,
    numberOfItems: inventory.count,
    itemListElement: inventory.listings.map((listing, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteListingUrl(listing, origin),
      name: listing.shortAddress,
    })),
  }
  const breadcrumbs = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${origin}/`,
      },
      ...group.crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 2,
        name: crumb.label,
        item: `${origin}${rentalsHref(crumb.path)}`,
      })),
    ],
  }
  const faq =
    group.faqs.length > 0
      ? {
          '@type': 'FAQPage',
          mainEntity: group.faqs.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        }
      : null

  return {
    '@context': 'https://schema.org',
    '@graph': [itemList, breadcrumbs, faq].filter(Boolean),
  }
}

export function homepageItemListJsonLd(listings: BrowseListing[], origin = publicShareOrigin()) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: "Homes for rent — Canary Property Management",
    url: `${origin}/rentals`,
    numberOfItems: listings.length,
    itemListElement: listings.map((listing, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteListingUrl(listing, origin),
      name: listing.shortAddress,
    })),
  }
}

function absoluteListingUrl(listing: BrowseListing, origin: string): string {
  const path = listing.href.split('?')[0] || '/'
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}
