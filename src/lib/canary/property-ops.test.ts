import { describe, expect, it } from 'vitest'
import {
  formatPropertyAddress,
  formatPropertyFullLabel,
  streetAddressHasCitySegment,
} from './property-ops'

describe('streetAddressHasCitySegment', () => {
  it('detects city as a later comma segment', () => {
    expect(
      streetAddressHasCitySegment(
        '37 A Gallants St, Paradise, NL A1L 1J2, Canada',
        'Paradise',
      ),
    ).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(
      streetAddressHasCitySegment('37 A Gallants St, paradise, NL', 'Paradise'),
    ).toBe(true)
  })

  it('does not treat city substring in the street name as a match', () => {
    expect(streetAddressHasCitySegment('12 Paradise Lane', 'Paradise')).toBe(false)
  })

  it('detects city when it is the final trailing segment', () => {
    expect(
      streetAddressHasCitySegment(
        '37 A Gallants St, Paradise, NL A1L 1J2, Canada, Paradise',
        'paradise',
      ),
    ).toBe(true)
  })
})

describe('formatPropertyFullLabel', () => {
  it('does not re-append city when street already includes it as a segment', () => {
    expect(
      formatPropertyFullLabel(
        '37 A Gallants St, Paradise, NL A1L 1J2, Canada',
        'Paradise',
      ),
    ).toBe('37 A Gallants St, Paradise, NL A1L 1J2, Canada')
  })

  it('appends city when street is street-only', () => {
    expect(formatPropertyFullLabel('12 Duckworth St', "St. John's")).toBe(
      "12 Duckworth St, St. John's",
    )
  })

  it('still appends city when the name only appears inside the street line', () => {
    expect(formatPropertyFullLabel('12 Paradise Lane', 'Paradise')).toBe(
      '12 Paradise Lane, Paradise',
    )
  })

  it('keeps optional unit suffix', () => {
    expect(
      formatPropertyFullLabel('12 Duckworth St', "St. John's", '10A'),
    ).toBe("12 Duckworth St, St. John's · 10A")
  })
})

describe('formatPropertyAddress', () => {
  it('avoids duplicate trailing city', () => {
    expect(
      formatPropertyAddress({
        street_address: '37 A Gallants St, Paradise, NL A1L 1J2, Canada',
        city: 'Paradise',
      }),
    ).toBe('37 A Gallants St, Paradise, NL A1L 1J2, Canada')
  })
})
