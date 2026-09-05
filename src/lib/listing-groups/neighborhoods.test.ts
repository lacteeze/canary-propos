import { describe, expect, it } from 'vitest'
import type { BrowseListing } from '@/lib/listings/browse-types'
import { neighborhoodFromBrief, resolveNeighborhood } from './neighborhoods'

function listing(partial: Partial<BrowseListing>): BrowseListing {
  return {
    id: 'x',
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
    hasGarage: false,
    tags: [],
    photo: null,
    photos: [],
    photoCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    availableFrom: null,
    ...partial,
  }
}

describe('neighborhoodFromBrief', () => {
  it('reads staff downtown / east / west tokens', () => {
    expect(neighborhoodFromBrief('Near downtown')).toBe('downtown')
    expect(neighborhoodFromBrief('East End')).toBe('east-end')
    expect(neighborhoodFromBrief('west-end')).toBe('west-end')
    expect(neighborhoodFromBrief('Near university')).toBeNull()
  })
})

describe('resolveNeighborhood', () => {
  it('prefers listing_brief over street', () => {
    expect(
      resolveNeighborhood(
        listing({
          streetAddress: '14 Cavell Ave, St. John\'s',
          neighborhood: 'West End',
        }),
      ),
    ).toBe('west-end')
  })

  it('maps seed downtown streets', () => {
    expect(resolveNeighborhood(listing({ streetAddress: "18 A Wood St, St. John's" }))).toBe('downtown')
    expect(resolveNeighborhood(listing({ streetAddress: "73 Casey St, St. John's" }))).toBe('downtown')
    expect(resolveNeighborhood(listing({ streetAddress: "14 Bonaventure Ave, St. John's" }))).toBe(
      'downtown',
    )
  })

  it('maps seed east and west streets', () => {
    expect(resolveNeighborhood(listing({ streetAddress: "14 Cavell Ave, St. John's" }))).toBe('east-end')
    expect(resolveNeighborhood(listing({ streetAddress: "29 A Halls Rd, St. John's" }))).toBe('east-end')
    expect(resolveNeighborhood(listing({ streetAddress: "49 Pleasant St, St. John's" }))).toBe('west-end')
    expect(resolveNeighborhood(listing({ streetAddress: "12 Pennywell Rd, St. John's" }))).toBe(
      'west-end',
    )
    expect(resolveNeighborhood(listing({ streetAddress: '560 B Southside Road, St. John\'s' }))).toBe(
      'west-end',
    )
  })

  it('leaves unmatched streets off neighbourhood pages', () => {
    expect(resolveNeighborhood(listing({ streetAddress: "26 Serpentine St, St. John's" }))).toBeNull()
    expect(resolveNeighborhood(listing({ streetAddress: '41 Gallants St, Paradise' }))).toBeNull()
  })
})
