import { describe, expect, it } from 'vitest'
import { bedsGroupPath, citySlugFromName, listingMatchesCitySlug } from './city'

describe('citySlugFromName', () => {
  it('normalizes St. Johns variants', () => {
    expect(citySlugFromName("St. John's")).toBe('st-johns')
    expect(citySlugFromName('St Johns')).toBe('st-johns')
    expect(citySlugFromName("Saint John's")).toBe('st-johns')
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

describe('listingMatchesCitySlug', () => {
  it('matches Paradise', () => {
    expect(listingMatchesCitySlug('Paradise', 'paradise')).toBe(true)
    expect(listingMatchesCitySlug("St. John's", 'paradise')).toBe(false)
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
