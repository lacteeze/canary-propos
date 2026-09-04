import { describe, expect, it } from 'vitest'
import type { BrowseListing } from '@/lib/listings/browse-types'
import { listingsForMatch } from './match'
import { listingGroupByPath } from './registry'
import { interpolateLead, inventoryForGroup } from './stats'

function listing(partial: Partial<BrowseListing> & Pick<BrowseListing, 'id'>): BrowseListing {
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

const sample = [
  listing({
    id: 'wood',
    city: "St. John's",
    beds: 1,
    rentN: 1100,
    streetAddress: "18 A Wood St, St. John's",
    propertyType: 'house',
    petFriendly: true,
  }),
  listing({
    id: 'gallants',
    city: 'Paradise',
    beds: 3,
    rentN: 2100,
    streetAddress: '41 Gallants St, Paradise',
    propertyType: 'house',
    petFriendly: true,
  }),
  listing({
    id: 'condo',
    city: "St. John's",
    beds: 2,
    rentN: 1800,
    streetAddress: "200 Water St, St. John's",
    propertyType: 'condo',
    petFriendly: false,
  }),
]

describe('listingsForMatch', () => {
  it('filters city, beds, type, pets, and neighbourhood', () => {
    expect(listingsForMatch(sample, { kind: 'city', citySlug: 'paradise' }).map((l) => l.id)).toEqual([
      'gallants',
    ])
    expect(listingsForMatch(sample, { kind: 'beds', min: 2, max: 2 }).map((l) => l.id)).toEqual(['condo'])
    expect(listingsForMatch(sample, { kind: 'beds', min: 3 }).map((l) => l.id)).toEqual(['gallants'])
    expect(listingsForMatch(sample, { kind: 'type', types: ['condo', 'apartment_building'] }).map((l) => l.id)).toEqual([
      'condo',
    ])
    expect(listingsForMatch(sample, { kind: 'amenity', amenity: 'pets' }).map((l) => l.id)).toEqual([
      'wood',
      'gallants',
    ])
    expect(
      listingsForMatch(sample, {
        kind: 'neighborhood',
        citySlug: 'st-johns',
        neighborhood: 'downtown',
      }).map((l) => l.id),
    ).toEqual(['wood', 'condo'])
    expect(
      listingsForMatch(sample, { kind: 'city-beds', citySlug: 'st-johns', min: 1, max: 1 }).map((l) => l.id),
    ).toEqual(['wood'])
  })
})

describe('listingGroupByPath', () => {
  it('resolves the index and a nested combo', () => {
    expect(listingGroupByPath('')?.kind).toBe('index')
    expect(listingGroupByPath('st-johns/2-bedroom')?.match).toEqual({
      kind: 'city-beds',
      citySlug: 'st-johns',
      min: 2,
      max: 2,
    })
  })
})

describe('interpolateLead', () => {
  it('fills live counts and uses the empty lead at zero', () => {
    const group = listingGroupByPath('st-johns/2-bedroom')
    if (!group) throw new Error('missing group')
    const populated = interpolateLead(group, inventoryForGroup(sample, group, new Date('2026-09-04T12:00:00-02:30')))
    expect(populated).toContain('1 two-bedroom home')
    expect(populated).toContain('$1,800')
    expect(populated).toContain('2026')

    const empty = interpolateLead(group, inventoryForGroup([], group, new Date('2026-09-04T12:00:00-02:30')))
    expect(empty).toMatch(/No two-bedroom homes listed today/)
    expect(empty).toContain('waitlist')
  })
})
