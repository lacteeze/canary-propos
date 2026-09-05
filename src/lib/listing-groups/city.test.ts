import { describe, expect, it } from 'vitest'
import {
  bedsGroupPath,
  cityFromStreetAddress,
  citySlugFromName,
  listingMatchesCitySlug,
} from './city'

describe('citySlugFromName', () => {
  it('normalizes St. Johns variants', () => {
    expect(citySlugFromName("St. John's")).toBe('st-johns')
    expect(citySlugFromName('St Johns')).toBe('st-johns')
    expect(citySlugFromName("Saint John's")).toBe('st-johns')
    expect(citySlugFromName("St.John's")).toBe('st-johns')
    expect(citySlugFromName("St. John's, NL")).toBe('st-johns')
  })

  it('maps CBS and Portugal Cove aliases', () => {
    expect(citySlugFromName('CBS')).toBe('conception-bay-south')
    expect(citySlugFromName("Portugal Cove-St. Philip's")).toBe('portugal-cove')
    expect(citySlugFromName("Clarke's Beach")).toBe('clarkes-beach')
  })

  it('returns null for unknown cities', () => {
    expect(citySlugFromName('Halifax')).toBeNull()
  })
})

describe('cityFromStreetAddress', () => {
  it('pulls the city out of a full civic address', () => {
    expect(
      cityFromStreetAddress("12 Water St, St. John's, NL A1C 1A1, Canada"),
    ).toBe("St. John's")
    expect(cityFromStreetAddress('41 Gallants St, Paradise, NL')).toBe('Paradise')
  })
})

describe('listingMatchesCitySlug', () => {
  it('matches Paradise', () => {
    expect(listingMatchesCitySlug('Paradise', 'paradise')).toBe(true)
    expect(listingMatchesCitySlug("St. John's", 'paradise')).toBe(false)
  })

  it('falls back to the street address when city is missing or packed', () => {
    expect(
      listingMatchesCitySlug(null, 'st-johns', "12 Water St, St. John's, NL A1C 1A1"),
    ).toBe(true)
    expect(listingMatchesCitySlug("St. John's, NL", 'st-johns')).toBe(true)
    expect(listingMatchesCitySlug('', 'dildo', '5 Front Rd, Dildo, NL')).toBe(true)
  })
})

describe('bedsGroupPath', () => {
  it('buckets 3+ together', () => {
    expect(bedsGroupPath(1)).toBe('1-bedroom')
    expect(bedsGroupPath(2)).toBe('2-bedroom')
    expect(bedsGroupPath(3)).toBe('3-bedroom')
    expect(bedsGroupPath(4)).toBe('3-bedroom')
  })
})
