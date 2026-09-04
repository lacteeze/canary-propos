import type { BrowseListing } from '@/lib/listings/browse-types'
import type { NeighborhoodSlug } from './types'

/** Street tokens matched against the first address segment (word-boundary). */
const NEIGHBORHOOD_STREETS: Record<NeighborhoodSlug, readonly string[]> = {
  downtown: [
    'water',
    'duckworth',
    'bond',
    'gower',
    'new gower',
    'queen',
    "queen's",
    'queens',
    'prescott',
    'cochrane',
    'military',
    'signal hill',
    'battery',
    'wood',
    'george',
    'holdsworth',
    "hill o'chips",
    'hill ochips',
    'temperance',
    'harbour',
    'plymouth',
    'adelaide',
    'cathedral',
    'church hill',
    'ordance',
    'ordnance',
    'colonial',
    'victoria',
    'holloway',
    'flavin',
    'livingstone',
    'hutchings',
    'rawlins',
    'flower hill',
    'bates',
    'cavendish',
    'monkstown',
    'boncloddy',
    'casey',
    'golf',
    'bonaventure',
    'gower street',
  ],
  'east-end': [
    'halls',
    'cavell',
    'quidi vidi',
    'logy bay',
    'the boulevard',
    'boulevard',
    'lake',
    'forest',
    'virginia',
    'whiteway',
    'carrick',
    'east meadows',
    'highland',
    'penney',
    'pleasantville',
    'torbay road',
    'stavanger',
    'airport heights',
  ],
  'west-end': [
    'pleasant',
    'pennywell',
    'lemarchant',
    'cornwall',
    'hamilton',
    'blackmarsh',
    'topsail',
    'craigmiller',
    'cashin',
    'roe',
    'sadler',
    'monds',
    'fraser',
    'smithville',
    'alexander',
    'cowan',
    'bowring',
    'waterford',
    'southside',
    'cornwall avenue',
  ],
}

function streetHaystack(listing: BrowseListing): string {
  return (listing.streetAddress || listing.shortAddress || '')
    .split(',')[0]
    ?.toLowerCase()
    .replace(/['’]/g, "'")
    ?? ''
}

function streetMatches(haystack: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[\\s,./-])${escaped}(?:$|[\\s,./-])`, 'i').test(haystack)
}

export function neighborhoodFromBrief(
  raw: string | null | undefined,
): NeighborhoodSlug | null {
  const value = (raw ?? '').toLowerCase()
  if (!value) return null
  if (/\beast[\s-]*end\b/.test(value)) return 'east-end'
  if (/\bwest[\s-]*end\b/.test(value)) return 'west-end'
  if (/\bdowntown\b/.test(value)) return 'downtown'
  return null
}

export function neighborhoodFromStreet(listing: BrowseListing): NeighborhoodSlug | null {
  const haystack = streetHaystack(listing)
  if (!haystack) return null
  for (const slug of ['downtown', 'east-end', 'west-end'] as const) {
    if (NEIGHBORHOOD_STREETS[slug].some((token) => streetMatches(haystack, token))) {
      return slug
    }
  }
  return null
}

export function resolveNeighborhood(listing: BrowseListing): NeighborhoodSlug | null {
  return neighborhoodFromBrief(listing.neighborhood) ?? neighborhoodFromStreet(listing)
}
