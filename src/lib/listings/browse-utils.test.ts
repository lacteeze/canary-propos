import { describe, it, expect } from 'vitest'
import {
  hasGarage,
  filterListings,
  parseBrowseFilters,
} from './browse-utils'
import type { BrowseListing } from './browse-types'

function listing(partial: Partial<BrowseListing> & Pick<BrowseListing, 'id' | 'hasGarage'>): BrowseListing {
  return {
    href: '/',
    shortAddress: '1 Test St',
    city: "St. John's",
    province: 'NL',
    rentN: 1500,
    rentFormatted: '$1,500',
    rentSuffix: 'POU',
    beds: 2,
    baths: 1,
    bathsLabel: '1',
    parking: '—',
    termType: 'long',
    termLabel: 'Long-term',
    termDot: '#000',
    moveIn: 'now',
    petFriendly: false,
    petLabel: null,
    tags: [],
    photo: null,
    photos: [],
    photoCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    availableFrom: null,
    ...partial,
  }
}

describe('hasGarage', () => {
  it('detects Garage amenity', () => {
    expect(hasGarage(['Garage'], null)).toBe(true)
  })

  it('returns false for parking/laundry without garage', () => {
    expect(hasGarage(['Parking', 'Laundry'], null)).toBe(false)
  })

  it('matches word-boundary garage inside parking garage', () => {
    expect(hasGarage(['parking garage'], null)).toBe(true)
  })

  it('does not match garages plural (no bare garage token)', () => {
    expect(hasGarage(['garages'], null)).toBe(false)
  })

  it('detects garage in optional description', () => {
    expect(hasGarage([], 'Unit includes a garage.')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(hasGarage(['GARAGE'], null)).toBe(true)
  })
})

describe('parseBrowseFilters garage', () => {
  it('parses garage=1 as true', () => {
    expect(parseBrowseFilters({ garage: '1' }).garage).toBe(true)
  })

  it('parses garage=true as true', () => {
    expect(parseBrowseFilters({ garage: 'true' }).garage).toBe(true)
  })

  it('defaults missing/empty garage to false', () => {
    expect(parseBrowseFilters({}).garage).toBe(false)
    expect(parseBrowseFilters({ garage: '' }).garage).toBe(false)
  })
})

describe('filterListings garage', () => {
  it('keeps only listings with hasGarage when filters.garage is true', () => {
    const listings = [
      listing({ id: 'with', hasGarage: true }),
      listing({ id: 'without', hasGarage: false }),
    ]
    const filtered = filterListings(listings, {
      q: '',
      term: 'all',
      beds: '',
      price: '',
      pets: false,
      garage: true,
      sort: 'new',
    })
    expect(filtered.map((l) => l.id)).toEqual(['with'])
  })
})
