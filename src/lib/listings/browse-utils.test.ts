import { describe, it, expect } from 'vitest'
import {
  hasGarage,
  hasUtilitiesIncluded,
  filterListings,
  mapListingRow,
  parseBrowseFilters,
  resolveParkingDisplay,
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

describe('hasUtilitiesIncluded', () => {
  it('detects utilities included in description', () => {
    expect(hasUtilitiesIncluded('Affordable living. Utilities included.')).toBe(true)
  })

  it('detects utilities and internet included', () => {
    expect(hasUtilitiesIncluded('Unit with utilities and internet included.')).toBe(true)
  })

  it('detects amenity / highlight tags', () => {
    expect(hasUtilitiesIncluded(null, ['Utilities included'], null)).toBe(true)
    expect(hasUtilitiesIncluded(null, null, ['Utilities included'])).toBe(true)
  })

  it('returns false when sparse or not included', () => {
    expect(hasUtilitiesIncluded(null)).toBe(false)
    expect(hasUtilitiesIncluded('1 bed, 1 bath, parking.')).toBe(false)
    expect(hasUtilitiesIncluded('Utilities not included.')).toBe(false)
  })
})

describe('resolveParkingDisplay', () => {
  it('prefers listing_brief.parking numeric count', () => {
    expect(
      resolveParkingDisplay({
        briefParking: '2 On-Street',
        description: 'No mention of spots here.',
        amenities: ['By approval'],
      })
    ).toBe('2')
  })

  it('treats No parking as em dash', () => {
    expect(resolveParkingDisplay({ briefParking: 'No parking' })).toBe('—')
  })

  it('defaults non-numeric brief parking to 1', () => {
    expect(resolveParkingDisplay({ briefParking: 'Street parking' })).toBe('1')
  })

  it('falls back to description when brief is empty', () => {
    expect(
      resolveParkingDisplay({
        briefParking: '',
        description: 'Unit includes 2 parking spaces.',
      })
    ).toBe('2')
  })

  it('returns em dash when nothing indicates parking', () => {
    expect(
      resolveParkingDisplay({
        briefParking: '',
        description: 'Cozy downtown apartment.',
        amenities: ['By approval'],
      })
    ).toBe('—')
  })
})

describe('mapListingRow value tags', () => {
  it('prioritizes utilities, garage, and pets on the card tags', () => {
    const mapped = mapListingRow(
      {
        id: 'casey-75',
        slug: '75-casey',
        listing_title: '75 Casey St',
        listing_description:
          'Pet-Friendly apartment. Utilities included. Private garage access.',
        display_rent: 1850,
        highlights: ['1 bedroom'],
        available_from: null,
        created_at: '2026-01-01T00:00:00Z',
        units: {
          id: 'u1',
          bedrooms: 1,
          bathrooms: 1,
          asking_rent: 1850,
          amenities: ['Garage'],
          properties: {
            id: 'p1',
            street_address: '75 Casey St, St. John\'s',
            city: "St. John's",
            province: 'NL',
            photo_paths: null,
          },
        },
      },
      '',
      ''
    )
    expect(mapped.rentSuffix).toBe('incl')
    expect(mapped.hasGarage).toBe(true)
    expect(mapped.petFriendly).toBe(true)
    expect(mapped.tags).toEqual(['Utilities included', 'Garage', 'Pets OK'])
  })

  it('reads parking from listing_brief on the property', () => {
    const mapped = mapListingRow(
      {
        id: 'casey-75',
        slug: '75-casey',
        listing_title: '75 Casey St',
        listing_description: 'Fully furnished downtown apartment. Utilities included.',
        display_rent: 1850,
        highlights: [],
        available_from: null,
        created_at: '2026-01-01T00:00:00Z',
        units: {
          id: 'u1',
          bedrooms: 1,
          bathrooms: 1,
          asking_rent: 1850,
          amenities: ['By approval'],
          properties: {
            id: 'p1',
            street_address: "75 Casey St, St. John's",
            city: "St. John's",
            province: 'NL',
            photo_paths: null,
            listing_brief: { parking: '2 On-Street', pets: 'By Approval' },
          },
        },
      },
      '',
      ''
    )
    expect(mapped.parking).toBe('2')
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
