import { deriveTermTypeFromHighlights } from '@/lib/landing/listing-term'
import { listingPublicHref } from '@/lib/listings/listing-href'
import { listingMatchesAddressQuery } from '@/lib/listings/slug-aliases'
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
    garage: params.garage === '1' || params.garage === 'true',
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

function parseMoveInDate(dateStr: string): Date {
  // Date-only ISO strings are UTC midnight; noon local keeps the calendar day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T12:00:00`)
  }
  return new Date(dateStr)
}

function formatMoveIn(dateStr: string | null): string {
  if (!dateStr) return 'now'
  const d = parseMoveInDate(dateStr)
  if (Number.isNaN(d.getTime())) return 'now'
  if (d <= new Date()) return 'now'
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Card label: "now" or "Sep 30" (no year). Detail pages keep the year via their own formatter. */
export function formatMoveInShort(dateStr: string | null): string {
  if (!dateStr) return 'now'
  const d = parseMoveInDate(dateStr)
  if (Number.isNaN(d.getTime())) return 'now'
  if (d <= new Date()) return 'now'
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function listingCorpus(
  description?: string | null,
  highlights?: string[] | null,
  amenities?: string[] | null
): string {
  return [description, ...(highlights ?? []), ...(amenities ?? [])]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join(' ')
}

/**
 * Public card / hero parking count.
 * Prefers properties.listing_brief.parking (what staff edit), then
 * description / highlights / amenities heuristics.
 */
export function resolveParkingDisplay(opts: {
  briefParking?: string | null
  description?: string | null
  highlights?: string[] | null
  amenities?: string[] | null
}): string {
  const brief = opts.briefParking?.trim()
  if (brief) {
    if (/^no\s+parking$/i.test(brief)) return '—'
    const fromBrief = brief.match(/(\d+)/)
    if (fromBrief?.[1]) return fromBrief[1]
    // Non-numeric parking info ("Street parking", "Assigned parking", etc.)
    return '1'
  }

  const amenities = opts.amenities ?? []
  const amenityHit = amenities.find((a) =>
    /\d+\s*parking|parking\s*[:\-]?\s*\d+|on[- ]?street|driveway/i.test(a)
  )
  if (amenityHit) {
    const n = amenityHit.match(/(\d+)/)
    if (n?.[1]) return n[1]
    if (/parking|on[- ]?street|driveway/i.test(amenityHit)) return '1'
  }

  const text = listingCorpus(opts.description, opts.highlights, amenities)
  if (/no\s+parking/i.test(text)) return '—'
  const match = text.match(/(\d+)\s*parking|parking\s*[:\-]?\s*(\d+)/i)
  if (match) return match[1] || match[2] || '—'
  if (/parking/i.test(text)) return '1'
  return '—'
}

/** Common staff typo for "included". */
function normalizeUtilitiesText(text: string): string {
  return text.replace(/\binlcuded\b/gi, 'included')
}

/**
 * Explicit utilities-included signals.
 * Accepts "utilities included" and multi-utility staff packages like
 * "Heat, Light & Internet Included" — not heat-only / single-item phrases.
 */
function textSaysUtilitiesIncluded(text: string): boolean {
  if (!text) return false
  const t = normalizeUtilitiesText(text)
  // Explicit "not included" / "no utilities" beats a loose "included" nearby.
  if (/\butilit(?:y|ies)\b[^.]{0,48}\bnot\s+included\b/i.test(t)) return false
  if (/\b(?:no|not)\s+utilities?\b/i.test(t)) return false
  // "utilities included", "utilities and internet included", amenity tag, etc.
  if (/\butilit(?:y|ies)\b[^.]{0,48}\bincluded\b/i.test(t)) return true
  // Staff package shorthand (2+ of heat / light-power / internet / water).
  if (!/\bincluded\b/i.test(t)) return false
  const signals = [
    /\bheat\b/i.test(t),
    /\b(?:light|lights|hydro|electricity|power)\b/i.test(t),
    /\binternet\b/i.test(t),
    /\b(?:hot\s+)?water\b/i.test(t),
  ].filter(Boolean).length
  return signals >= 2
}

/** Pay-own / not-included signals (POU, tenant pays, hydro extra, etc.). */
function textSaysUtilitiesPayOwn(text: string): boolean {
  if (!text) return false
  const t = normalizeUtilitiesText(text)
  if (/\bPOU\b/i.test(t)) return true
  if (/pay\s*own\s*utilit/i.test(t)) return true
  if (/tenant\s+pays?\s+utilit/i.test(t)) return true
  if (/tenant\s+responsible\s+for\s+utilit/i.test(t)) return true
  if (/\butilit(?:y|ies)\b[^.]{0,48}\bnot\s+included\b/i.test(t)) return true
  if (/\b(?:no|not)\s+utilities?\b/i.test(t)) return true
  if (/\bhydro\s+extra\b/i.test(t)) return true
  if (/\butilit(?:y|ies)\b[^.]{0,40}\b(?:extra|separate)\b/i.test(t)) return true
  return false
}

/** Public card utilities chip — only these two labels. */
export type UtilitiesCardLabel = 'Utilities included' | 'POU'

/**
 * Public card utilities chip.
 * Prefers properties.listing_brief.utilities (what staff edit), then
 * description / highlights / amenities heuristics.
 * Included wins over POU when both somehow match.
 * Unrecognized brief values (e.g. "Heat included") fall through to copy.
 */
export function resolveUtilitiesLabel(opts: {
  briefUtilities?: string | null
  description?: string | null
  highlights?: string[] | null
  amenities?: string[] | null
}): UtilitiesCardLabel | null {
  const brief = opts.briefUtilities?.trim()
  if (brief) {
    if (textSaysUtilitiesIncluded(brief)) return 'Utilities included'
    if (textSaysUtilitiesPayOwn(brief)) return 'POU'
    // Partial / unrecognized staff values — try listing copy next.
  }

  const text = listingCorpus(opts.description, opts.highlights, opts.amenities)
  if (!text) return null
  if (textSaysUtilitiesIncluded(text)) return 'Utilities included'
  if (textSaysUtilitiesPayOwn(text)) return 'POU'
  return null
}

/**
 * True when listing copy / amenities clearly say utilities are included.
 * Does not invent inclusion — sparse or "not included" text returns false.
 * Prefers listing_brief.utilities when set.
 */
export function hasUtilitiesIncluded(
  description?: string | null,
  highlights?: string[] | null,
  amenities?: string[] | null,
  briefUtilities?: string | null
): boolean {
  return (
    resolveUtilitiesLabel({
      briefUtilities,
      description,
      highlights,
      amenities,
    }) === 'Utilities included'
  )
}

/**
 * True when listing copy / amenities clearly allow pets (including by approval).
 * Recognizes synced amenity tags like bare "By approval" from listing_brief.pets.
 */
export function isPetFriendly(
  amenities: string[] | null,
  description: string | null,
  highlights?: string[] | null,
  briefPets?: string | null
): boolean {
  const brief = briefPets?.trim()
  if (brief) return !/^no pets$/i.test(brief)

  const text = listingCorpus(description, highlights, amenities)
  if (!text) return false
  if (/\bno pets\b/i.test(text) && !/by\s*approval|considered|negotiable|allowed|welcome|ok\b/i.test(text)) {
    return false
  }
  return /pet[\s-]*friendly|pets?\s*(considered|by\s*approval|allowed|welcome|negotiable|ok|okay)|(?:^|[\s,;|/])by\s*approval\b|welcome(?:\s*\/\s*|\s+)by\s*approval|dog[\s-]*friendly|cat[\s-]*friendly|cats?\s*ok|dogs?\s*ok/i.test(
    text
  )
}

/** True iff amenities (and optional description) contain a bare `garage` token. */
export function hasGarage(
  amenities: string[] | null,
  description?: string | null,
  highlights?: string[] | null
): boolean {
  const text = listingCorpus(description, highlights, amenities)
  return /\bgarage\b/i.test(text)
}

/**
 * Public card pet value chip.
 * Prefers properties.listing_brief.pets (what staff edit), then
 * description / highlights / amenities heuristics.
 */
export function resolvePetLabel(opts: {
  briefPets?: string | null
  description?: string | null
  highlights?: string[] | null
  amenities?: string[] | null
}): string | null {
  const brief = opts.briefPets?.trim()
  if (brief) {
    if (/^no pets$/i.test(brief)) return null
    if (/by\s*approval|considered|negotiable/i.test(brief)) return 'Pets by approval'
    if (/^pets?\s*ok$/i.test(brief) || /pet[\s-]*friendly/i.test(brief)) return 'Pets OK'
    // Cats OK / Dogs OK / custom staff text — show as stored
    return brief
  }

  if (!isPetFriendly(opts.amenities ?? null, opts.description ?? null, opts.highlights)) {
    return null
  }
  const text = listingCorpus(opts.description, opts.highlights, opts.amenities)
  if (/by\s*approval|considered|negotiable/i.test(text)) {
    return 'Pets by approval'
  }
  return 'Pets OK'
}

function termDot(termType: BrowseListing['termType']): string {
  if (termType === 'short') return 'var(--amber, #c1913f)'
  if (termType === 'mid') return '#7d9dc9'
  return 'var(--green, #6d9866)'
}

export type ListingRow = {
  id: string
  slug?: string | null
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
      listing_brief?: unknown
    } | null
  } | null
}

export function mapListingRow(
  listing: ListingRow,
  storageBase: string,
  orgQuery: string,
  _index = 0
): BrowseListing {
  const unit = listing.units
  const property = unit?.properties
  const rentN = listing.display_rent ?? unit?.asking_rent ?? null
  const termType = deriveTermTypeFromHighlights(listing.highlights)
  const termLabel =
    termType === 'mid' ? 'Mid-term' : 'Long-term'
  const amenities = unit?.amenities ?? null
  const brief =
    property?.listing_brief &&
    typeof property.listing_brief === 'object' &&
    !Array.isArray(property.listing_brief)
      ? (property.listing_brief as { parking?: unknown; pets?: unknown; utilities?: unknown })
      : null
  const briefParking = brief ? String(brief.parking ?? '') : ''
  const briefPets = brief ? String(brief.pets ?? '').trim() : ''
  const briefUtilities = brief ? String(brief.utilities ?? '').trim() : ''
  const briefPetsActive = Boolean(briefPets && !/^no pets$/i.test(briefPets))
  const label = resolvePetLabel({
    briefPets,
    description: listing.listing_description,
    highlights: listing.highlights,
    amenities,
  })
  const pet = isPetFriendly(
    amenities,
    listing.listing_description,
    listing.highlights,
    briefPets
  )
  const garage = hasGarage(amenities, listing.listing_description, listing.highlights)
  const parking = resolveParkingDisplay({
    briefParking,
    description: listing.listing_description,
    highlights: listing.highlights,
    amenities,
  })
  const utilitiesLabel = resolveUtilitiesLabel({
    briefUtilities,
    description: listing.listing_description,
    highlights: listing.highlights,
    amenities,
  })
  const suffix: BrowseListing['rentSuffix'] =
    utilitiesLabel === 'Utilities included' ? 'incl' : 'POU'

  // Value-justifying signals for the card — prioritize rent justification.
  // When staff set listing_brief.pets, always reserve a slot for that chip.
  const optionalTags: string[] = []
  if (utilitiesLabel) optionalTags.push(utilitiesLabel)
  if (garage) optionalTags.push('Garage')
  if (label && !briefPetsActive) optionalTags.push(label)
  const tags =
    briefPetsActive && label
      ? [...optionalTags.slice(0, 2), label]
      : optionalTags.slice(0, 3)

  const rawPaths = (property?.photo_paths ?? []).filter(
    (p): p is string => !!p && !/^https?:\/\//i.test(p)
  )
  const photos = rawPaths.map((p) => (storageBase ? `${storageBase}/${p}` : p))
  const photo = photos[0] ?? null

  return {
    id: listing.id,
    href: listingPublicHref({ id: listing.id, slug: listing.slug }, orgQuery),
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
    hasGarage: garage,
    tags,
    photo,
    photos,
    photoCount: photos.length,
    createdAt: listing.created_at,
    availableFrom: listing.available_from,
  }
}

export function filterListings(listings: BrowseListing[], filters: BrowseFilters): BrowseListing[] {
  const q = filters.q.toLowerCase()

  return listings.filter((listing) => {
    if (q && !listingMatchesAddressQuery(q, listing)) return false

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
    if (filters.garage && !listing.hasGarage) return false

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
  currentCity: string | null | undefined,
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

function normalizeCity(city: string | null | undefined): string {
  return (city ?? '').trim() || 'Other'
}

function displayCityGroup(city: string | null | undefined, options?: CityGroupOptions): string {
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
