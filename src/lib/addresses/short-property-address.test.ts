import { describe, expect, it } from 'vitest'
import { shortPropertyAddress } from './short-property-address'

describe('shortPropertyAddress', () => {
  it('strips postal, country, and duplicate city from Google-style addresses', () => {
    expect(
      shortPropertyAddress('37 A Gallants St, Paradise, NL A1L 1J2, Canada, Paradise')
    ).toBe('37 A Gallants St, Paradise, NL')
  })

  it('keeps already-short street/city/province forms', () => {
    expect(shortPropertyAddress('37 A Gallants St, Paradise, NL')).toBe(
      '37 A Gallants St, Paradise, NL'
    )
  })

  it('handles postal in its own segment', () => {
    expect(
      shortPropertyAddress('12 Duckworth St, St. John\'s, NL, A1C 1G4, Canada')
    ).toBe('12 Duckworth St, St. John\'s, NL')
  })

  it('returns street-only when that is all that remains', () => {
    expect(shortPropertyAddress('37 A Gallants St')).toBe('37 A Gallants St')
  })

  it('returns empty for blank input', () => {
    expect(shortPropertyAddress('')).toBe('')
    expect(shortPropertyAddress(null)).toBe('')
    expect(shortPropertyAddress(undefined)).toBe('')
  })
})
