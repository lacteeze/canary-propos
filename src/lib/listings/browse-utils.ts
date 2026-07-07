import { CARD_PHOTOS } from '@/lib/landing/content'
import { deriveTermTypeFromHighlights } from '@/lib/landing/listing-term'
import type {
  BrowseFilters,
  BrowseListing,
  BrowseSearchParams,
  BrowseSort,
  BrowseTermFilter,
  CityGroup,
} from './browse-types'

export function parseBrowseFilters(params: BrowseSearchParams): BrowseFilters {
  const term = params.term as BrowseTermFilter | undefined
  const sort = params.sort as BrowseSort | undefined
  return {
    q: params.q?.trim() ?? '',
    term: term === 'long' || term === 'mid' || term === 'short' ? term : 'all',
    beds: params.beds ?? '',
    price: params.price ?? '',
    pets: params.pets === '1' || params.pets === 'true',
    sort: sort === 'lo' || sort === 'hi' || sort === 'soon' ? sort : 'new',
  }
}

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

function formatMoveIn(dateStr: string | null): string {
  if (!dateStr) return 'now'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'now'
  if (d <= new Date()) return 'now'
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function extractParking(description: string | null, highlights: string[] | null): string {
  const text = [description, ...(highlights ?? [])].filter(Boolean).join(' ')
  const match = text.match(/(\d+)\s+parking/i)
  if (match) return match[1]
  if (/parking/i.test(text)) return '1'
  return '—'
}

function rentSuffix(description: string | null): 'incl' | 'POU' {
  if (!description) return 'POU'
  if (/utilities?\s+included/i.test(description) && !/not\s+included/i.test(description)) {
    return 'incl'
  }
  return 'POU'
}

function isPetFriendly(amenities: string[] | null, description: string | null): boolean {
  const text = [...(amenities ?? []), description ?? ''].join(' ')
  return /pet\s*friendly|pets?\s*(considered|by\s*approval|allowed|welcome)|dog\s*friendly|cat\s*friendly|\byes\b/i.test(
    text
  )
}

function petLabel(amenities: string[] | null, description: string | null): string | null {
  if (!isPetFriendly(amenities, description)) return null
  if (/by\s*approval|considered/i.test([...(amenities ?? []), description ?? ''].join(' '))) {
    return 'Pets by approval'
  }
  return 'Pet friendly'
}

function termDot(termType: BrowseListing['termType']): string {
  if (termType === 'short') return 'var(--amber, #c1913f)'
  if (termType === 'mid') return '#7d9dc9'
  return 'var(--green, #6d9866)'
}

export type ListingRow = {
  id: string
  listing_title: string
  listing_description: string | null
  display_rent: number | null
  highlights: string[] | null
  available_from: string | null
  created_at: string
  units: {
    id: string
    bedrooms: number
    bathrooms: number
    asking_rent: number | null
    amenities: string[] | null
    properties: {
      id: string
      street_address: string
      city: string
      province: string
      photo_paths: string[] | null
    } | null
  } | null
}

export function mapListingRow(
  listing: ListingRow,
  storageBase: string,
  orgQuery: string,
  index = 0
): BrowseListing {
  const unit = listing.units
  const property = unit?.properties
  const rentN = listing.display_rent ?? unit?.asking_rent ?? null
  const termType = deriveTermTypeFromHighlights(listing.highlights)
  const termLabel =
    termType === 'mid' ? 'Mid-term' : 'Long-term'
  const pet = isPetFriendly(unit?.amenities ?? null, listing.listing_description)
  const parking = extractParking(listing.listing_description, listing.highlights)
  const suffix = rentSuffix(listing.listing_description)
  const label = petLabel(unit?.amenities ?? null, listing.listing_description)

  const tags: string[] = []
  if (label) tags.push(`🐾 ${label}`)
  if (suffix === 'incl') tags.push('Utilities included')

  const photo =
    property?.photo_paths?.[0]
      ? `${storageBase}/${property.photo_paths[0]}`
      : CARD_PHOTOS[index % CARD_PHOTOS.length]

  return {
    id: listing.id,
    href: `/listings/${listing.id}${orgQuery}`,
    shortAddress: shortAddress(property?.street_address ?? listing.listing_title),
    city: property?.city ?? "St. John's",
    province: property?.province ?? 'NL',
    rentN,
    rentFormatted: rentN ? formatCAD(rentN) : '—',
    rentSuffix: suffix,
    beds: unit?.bedrooms ?? 0,
    baths: unit?.bathrooms ?? 0,
    bathsLabel: String(unit?.bathrooms ?? '—').replace(/\.0$/, ''),
    parking,
    termType,
    termLabel,
    termDot: termDot(termType),
    moveIn: formatMoveIn(listing.available_from),
    petFriendly: pet,
    petLabel: label,
    tags: tags.slice(0, 2),
    photo,
    createdAt: listing.created_at,
    availableFrom: listing.available_from,
  }
}

export function filterListings(listings: BrowseListing[], filters: BrowseFilters): BrowseListing[] {
  const q = filters.q.toLowerCase()

  return listings.filter((listing) => {
    if (q) {
      const haystack = `${listing.shortAddress} ${listing.city} ${listing.province}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }

    if (filters.term === 'long' && listing.termType !== 'long') return false
    if (filters.term === 'mid' && listing.termType !== 'mid') return false
    if (filters.term === 'short' && listing.termType !== 'short') return false

    if (filters.beds) {
      const minBeds = parseInt(filters.beds, 10)
      if (!Number.isNaN(minBeds) && listing.beds < minBeds) return false
    }

    if (filters.price) {
      const maxPrice = parseFloat(filters.price)
      if (!Number.isNaN(maxPrice) && (!listing.rentN || listing.rentN >= maxPrice)) return false
    }

    if (filters.pets && !listing.petFriendly) return false

    return true
  })
}

export function sortListings(listings: BrowseListing[], sort: BrowseSort): BrowseListing[] {
  const sorted = [...listings]
  if (sort === 'lo') {
    sorted.sort((a, b) => (a.rentN ?? Infinity) - (b.rentN ?? Infinity))
  } else if (sort === 'hi') {
    sorted.sort((a, b) => (b.rentN ?? 0) - (a.rentN ?? 0))
  } else if (sort === 'soon') {
    sorted.sort((a, b) => {
      const aDate = a.availableFrom ? new Date(a.availableFrom).getTime() : 0
      const bDate = b.availableFrom ? new Date(b.availableFrom).getTime() : 0
      return aDate - bDate
    })
  } else {
    sorted.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        (a.rentN ?? 0) - (b.rentN ?? 0)
    )
  }
  return sorted
}

/** Published listings in the same city as the current detail page (excludes self). */
export function filterSimilarListings(
  listings: BrowseListing[],
  currentId: string,
  city: string,
  limit = 12
): BrowseListing[] {
  const target = normalizeCity(city).toLowerCase()
  return listings
    .filter((l) => l.id !== currentId && normalizeCity(l.city).toLowerCase() === target)
    .slice(0, limit)
}

/**
 * City-grouped carousels for a listing detail page: current city first, then other towns.
 * Excludes the viewed listing; uses the same city grouping as the landing page.
 */
export function getDetailPageCarouselGroups(
  listings: BrowseListing[],
  currentId: string,
  currentCity: string,
  options: CityGroupOptions = { mergeOuterBay: true }
): CityGroup[] {
  const currentDisplay = displayCityGroup(currentCity, options)
  const groups = groupListingsByCity(
    listings.filter((l) => l.id !== currentId),
    options
  ).filter((g) => g.listings.length > 0)

  const currentGroup = groups.find((g) => g.city === currentDisplay)
  const otherGroups = groups.filter((g) => g.city !== currentDisplay)

  return [...(currentGroup ? [currentGroup] : []), ...otherGroups]
}

const OUTER_BAY_GROUP = "Clarke's Beach & Dildo"

export type CityGroupOptions = {
  /** Merge Clarke's Beach and Dildo into one section (landing page). */
  mergeOuterBay?: boolean
}

function normalizeCity(city: string): string {
  return city.trim() || 'Other'
}

function displayCityGroup(city: string, options?: CityGroupOptions): string {
  const normalized = normalizeCity(city)
  if (options?.mergeOuterBay) {
    if (/clarke'?s?\s*beach/i.test(normalized) || /^dildo$/i.test(normalized)) {
      return OUTER_BAY_GROUP
    }
  }
  return normalized
}

function citySortKey(city: string, options?: CityGroupOptions): [number, string] {
  if (/st\.?\s*john'?s/i.test(city)) return [0, '']
  if (options?.mergeOuterBay) {
    if (/^paradise$/i.test(city)) return [1, '']
    if (city === OUTER_BAY_GROUP) return [2, '']
  }
  const isStJohns = /st\.?\s*john'?s/i.test(city)
  return [isStJohns ? 0 : 1, city.toLocaleLowerCase()]
}

export function groupListingsByCity(
  listings: BrowseListing[],
  options?: CityGroupOptions
): CityGroup[] {
  const byCity = new Map<string, BrowseListing[]>()
  for (const listing of listings) {
    const city = displayCityGroup(listing.city, options)
    const group = byCity.get(city) ?? []
    group.push(listing)
    byCity.set(city, group)
  }

  return [...byCity.entries()]
    .sort(([a], [b]) => {
      const [aPri, aName] = citySortKey(a, options)
      const [bPri, bName] = citySortKey(b, options)
      return aPri - bPri || aName.localeCompare(bName)
    })
    .map(([city, cityListings]) => ({ city, listings: cityListings }))
}

export function countLabel(filtered: number, total: number): string {
  const noun = total === 1 ? 'home' : 'homes'
  return `${filtered} of ${total} available ${noun}`
}

export const TERM_TABS: { key: BrowseTermFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'long', label: 'Long-term' },
  { key: 'mid', label: 'Mid-term' },
  { key: 'short', label: 'Short-term' },
]
