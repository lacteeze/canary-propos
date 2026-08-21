import { describe, expect, it } from 'vitest'
import {
  ensureGeneralInterestNote,
  parseInterestAreaFromNote,
  parseInterestBedsFromNote,
  rankMatchingHomes,
  scoreHomeMatch,
  type MatchHomeCandidate,
  type MatchHomeCriteria,
} from './match-homes'

const criteria: MatchHomeCriteria = {
  propertyId: 'src-prop',
  city: "St. John's",
  bedrooms: 2,
  bathrooms: 1,
  rent: 1600,
}

function home(partial: Partial<MatchHomeCandidate> & { propertyId: string }): MatchHomeCandidate {
  return {
    listingId: null,
    address: '1 Test St',
    city: "St. John's",
    beds: 2,
    baths: 1,
    rent: 1550,
    availableFrom: '2026-09-01',
    status: 'Listed',
    href: '/test',
    slug: 'test',
    ...partial,
  }
}

describe('scoreHomeMatch', () => {
  it('excludes the source property', () => {
    expect(scoreHomeMatch(criteria, home({ propertyId: 'src-prop' }))).toBeNull()
  })

  it('rejects large bedroom mismatches', () => {
    expect(scoreHomeMatch(criteria, home({ propertyId: 'a', beds: 5 }))).toBeNull()
  })

  it('scores same-city listed homes highly', () => {
    const score = scoreHomeMatch(criteria, home({ propertyId: 'a' }))
    expect(score).toBeGreaterThan(80)
  })
})

describe('rankMatchingHomes', () => {
  it('returns top matches only', () => {
    const ranked = rankMatchingHomes(
      criteria,
      [
        home({ propertyId: 'a', rent: 1500 }),
        home({ propertyId: 'b', beds: 3, rent: 1700, status: 'Vacant' }),
        home({ propertyId: 'c', city: 'Paradise', beds: 2 }),
      ],
      8,
    )
    expect(ranked[0]?.propertyId).toBe('a')
    expect(ranked.every((h) => h.propertyId !== 'src-prop')).toBe(true)
  })
})

describe('ensureGeneralInterestNote', () => {
  it('adds prefix and converted-from line', () => {
    const note = ensureGeneralInterestNote('Wants quiet street', '12 Duckworth St')
    expect(note.startsWith('[General interest]')).toBe(true)
    expect(note).toContain('Converted from: 12 Duckworth St')
    expect(note).toContain('Wants quiet street')
  })

  it('does not duplicate converted-from', () => {
    const once = ensureGeneralInterestNote(null, 'A')
    const twice = ensureGeneralInterestNote(once, 'B')
    expect(twice.match(/Converted from:/g)?.length).toBe(1)
  })
})

describe('parseInterestBedsFromNote', () => {
  it('reads Beds: N+ lines', () => {
    expect(parseInterestBedsFromNote('[General interest]\nBeds: 2+\nPets: yes')).toBe(2)
    expect(parseInterestBedsFromNote('Beds: 3')).toBe(3)
  })

  it('returns null when missing', () => {
    expect(parseInterestBedsFromNote('Preferred area: Paradise')).toBeNull()
    expect(parseInterestBedsFromNote(null)).toBeNull()
  })
})

describe('parseInterestAreaFromNote', () => {
  it('reads Preferred area lines', () => {
    expect(parseInterestAreaFromNote('Preferred area: Mount Pearl')).toBe('Mount Pearl')
  })
})
