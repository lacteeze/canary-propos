import { describe, it, expect } from 'vitest'
import {
  hasGarage,
  hasUtilitiesIncluded,
  filterListings,
  getDetailPageCarouselGroups,
  isPetFriendly,
  mapListingRow,
  parseBrowseFilters,
  resolveParkingDisplay,
  resolvePetLabel,
  resolveUtilitiesLabel,
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

  it('prefers listing_brief.utilities when set', () => {
    expect(
      hasUtilitiesIncluded('Tenant pays utilities.', null, null, 'Utilities included')
    ).toBe(true)
    expect(
      hasUtilitiesIncluded('Utilities included.', null, null, 'Tenant pays utilities')
    ).toBe(false)
  })
})

describe('resolveUtilitiesLabel', () => {
  it('labels brief POU as POU', () => {
    expect(resolveUtilitiesLabel({ briefUtilities: 'POU' })).toBe('POU')
    expect(resolveUtilitiesLabel({ briefUtilities: 'POU — tenant responsibility' })).toBe('POU')
  })

  it('labels tenant-pays / not-included briefs as POU', () => {
    expect(resolveUtilitiesLabel({ briefUtilities: 'Tenant pays utilities' })).toBe('POU')
    expect(resolveUtilitiesLabel({ briefUtilities: 'Utilities not included' })).toBe('POU')
  })

  it('labels utilities included brief', () => {
    expect(resolveUtilitiesLabel({ briefUtilities: 'Utilities included' })).toBe(
      'Utilities included'
    )
  })

  it('labels heat/light/internet package briefs as Utilities included', () => {
    expect(
      resolveUtilitiesLabel({ briefUtilities: 'Heat, Light & Internet Included' })
    ).toBe('Utilities included')
    // Common staff typo
    expect(
      resolveUtilitiesLabel({ briefUtilities: 'Heat, Light & Internet Inlcuded' })
    ).toBe('Utilities included')
  })

  it('does not invent a chip for partial heat-included brief alone', () => {
    expect(resolveUtilitiesLabel({ briefUtilities: 'Heat included' })).toBe(null)
  })

  it('falls through partial brief to description included copy', () => {
    expect(
      resolveUtilitiesLabel({
        briefUtilities: 'Heat included',
        description: 'Bright unit. Utilities included.',
      })
    ).toBe('Utilities included')
  })

  it('detects POU phrases in description / amenities', () => {
    expect(resolveUtilitiesLabel({ description: 'Bright unit. POU.' })).toBe('POU')
    expect(
      resolveUtilitiesLabel({ description: 'Tenant pays utilities. Parking on street.' })
    ).toBe('POU')
    expect(resolveUtilitiesLabel({ description: 'Hydro extra. Nice kitchen.' })).toBe('POU')
    expect(resolveUtilitiesLabel({ amenities: ['Pay own utilities'] })).toBe('POU')
    expect(resolveUtilitiesLabel({ highlights: ['Utilities not included'] })).toBe('POU')
  })

  it('included wins over POU when both match', () => {
    expect(
      resolveUtilitiesLabel({
        description: 'Utilities included. Note: some listings say POU.',
      })
    ).toBe('Utilities included')
    expect(
      resolveUtilitiesLabel({
        briefUtilities: 'Utilities included',
        description: 'POU / tenant pays utilities.',
      })
    ).toBe('Utilities included')
  })

  it('prefers listing_brief.utilities over conflicting copy', () => {
    expect(
      resolveUtilitiesLabel({
        briefUtilities: 'POU',
        description: 'Utilities included in marketing copy.',
      })
    ).toBe('POU')
  })

  it('never returns Utilities not included label', () => {
    expect(resolveUtilitiesLabel({ briefUtilities: 'Utilities not included' })).not.toBe(
      'Utilities not included'
    )
    expect(resolveUtilitiesLabel({ description: 'Utilities not included.' })).toBe('POU')
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

describe('resolvePetLabel', () => {
  it('prefers listing_brief.pets By approval', () => {
    expect(
      resolvePetLabel({
        briefPets: 'By approval',
        description: 'No pets mentioned in copy.',
        amenities: [],
      })
    ).toBe('Pets by approval')
  })

  it('recognizes synced bare By approval amenity without brief', () => {
    expect(
      resolvePetLabel({
        briefPets: '',
        amenities: ['By approval'],
      })
    ).toBe('Pets by approval')
  })

  it('treats No pets brief as no chip', () => {
    expect(resolvePetLabel({ briefPets: 'No pets', amenities: ['Pet friendly'] })).toBe(null)
  })

  it('keeps Cats OK exact label from brief', () => {
    expect(resolvePetLabel({ briefPets: 'Cats OK' })).toBe('Cats OK')
  })
})

describe('isPetFriendly', () => {
  it('matches bare By approval amenity', () => {
    expect(isPetFriendly(['By approval'], null)).toBe(true)
  })

  it('respects listing_brief No pets', () => {
    expect(isPetFriendly(['Pet friendly'], null, null, 'No pets')).toBe(false)
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

  it('reads parking and pets from listing_brief on the property', () => {
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
    expect(mapped.petFriendly).toBe(true)
    expect(mapped.petLabel).toBe('Pets by approval')
    expect(mapped.tags).toContain('Pets by approval')
  })

  it('keeps brief pets chip when utilities and garage fill other slots', () => {
    const mapped = mapListingRow(
      {
        id: 'signal-151a',
        slug: '151-a-signal-hill',
        listing_title: '151 A Signal Hill',
        listing_description: 'Utilities included. Private garage. Bright apartment.',
        display_rent: 2200,
        highlights: [],
        available_from: null,
        created_at: '2026-01-01T00:00:00Z',
        units: {
          id: 'u1',
          bedrooms: 2,
          bathrooms: 1,
          asking_rent: 2200,
          amenities: ['Garage', 'By approval'],
          properties: {
            id: 'p1',
            street_address: "151 A Signal Hill Rd, St. John's",
            city: "St. John's",
            province: 'NL',
            photo_paths: null,
            listing_brief: { pets: 'By approval', parking: '1 Off-Street' },
          },
        },
      },
      '',
      ''
    )
    expect(mapped.tags).toEqual(['Utilities included', 'Garage', 'Pets by approval'])
  })

  it('shows POU chip from listing_brief.utilities and not both utilities tags', () => {
    const mapped = mapListingRow(
      {
        id: 'pou-1',
        slug: 'pou-unit',
        listing_title: '12 Water St',
        listing_description: 'Bright apartment. Utilities included in old copy.',
        display_rent: 1600,
        highlights: [],
        available_from: null,
        created_at: '2026-01-01T00:00:00Z',
        units: {
          id: 'u1',
          bedrooms: 1,
          bathrooms: 1,
          asking_rent: 1600,
          amenities: ['Garage'],
          properties: {
            id: 'p1',
            street_address: "12 Water St, St. John's",
            city: "St. John's",
            province: 'NL',
            photo_paths: null,
            listing_brief: { utilities: 'POU', pets: 'No pets', parking: '1 driveway spot' },
          },
        },
      },
      '',
      ''
    )
    expect(mapped.rentSuffix).toBe('POU')
    expect(mapped.tags).toContain('POU')
    expect(mapped.tags).not.toContain('Utilities included')
    expect(mapped.tags[0]).toBe('POU')
  })

  it('shows POU chip from tenant-pays brief', () => {
    const mapped = mapListingRow(
      {
        id: 'tenant-pays',
        slug: 'tenant-pays',
        listing_title: '9 Duckworth',
        listing_description: 'Downtown walk-up.',
        display_rent: 1400,
        highlights: [],
        available_from: null,
        created_at: '2026-01-01T00:00:00Z',
        units: {
          id: 'u1',
          bedrooms: 1,
          bathrooms: 1,
          asking_rent: 1400,
          amenities: [],
          properties: {
            id: 'p1',
            street_address: "9 Duckworth St, St. John's",
            city: "St. John's",
            province: 'NL',
            photo_paths: null,
            listing_brief: { utilities: 'Tenant pays utilities' },
          },
        },
      },
      '',
      ''
    )
    expect(mapped.tags).toEqual(['POU'])
    expect(mapped.tags).not.toContain('Utilities not included')
  })

  it('shows Utilities included from heat/light/internet listing_brief', () => {
    const mapped = mapListingRow(
      {
        id: 'casey-75-pkg',
        slug: '75-casey',
        listing_title: '75 Casey St',
        listing_description: 'Fully furnished 1-bedroom. No utility wording here.',
        display_rent: 1850,
        highlights: [],
        available_from: null,
        created_at: '2026-01-01T00:00:00Z',
        units: {
          id: 'u1',
          bedrooms: 1,
          bathrooms: 1,
          asking_rent: 1850,
          amenities: [],
          properties: {
            id: 'p1',
            street_address: "75 Casey St, St. John's",
            city: "St. John's",
            province: 'NL',
            photo_paths: null,
            listing_brief: { utilities: 'Heat, Light & Internet Inlcuded' },
          },
        },
      },
      '',
      ''
    )
    expect(mapped.rentSuffix).toBe('incl')
    expect(mapped.tags).toContain('Utilities included')
    expect(mapped.tags[0]).toBe('Utilities included')
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

describe('getDetailPageCarouselGroups', () => {
  it('does not throw when the current city is missing', () => {
    expect(() => getDetailPageCarouselGroups([], 'listing-1', null)).not.toThrow()
    expect(getDetailPageCarouselGroups([], 'listing-1', undefined)).toEqual([])
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

describe('filterListings street suffix', () => {
  it('matches rd addresses when the query uses road', () => {
    const listings = [
      listing({
        id: 'pond',
        hasGarage: false,
        href: '/156-three-island-pond-rd',
        shortAddress: '156 Three Island Pond Rd',
      }),
    ]
    const filtered = filterListings(listings, {
      q: 'https://canarypm.ca/156-three-island-pond-road',
      term: 'all',
      beds: '',
      price: '',
      pets: false,
      garage: false,
      sort: 'new',
    })
    expect(filtered.map((l) => l.id)).toEqual(['pond'])
  })
})
