import { describe, expect, it } from 'vitest'
import {
  defaultNewPropertyUnit,
  formatPropertyAddress,
  formatPropertyFullLabel,
  sortPropertiesNewestFirst,
  streetAddressHasCitySegment,
  stripTrailingDuplicateCity,
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

  it('matches St. John\'s despite apostrophe / punctuation differences', () => {
    expect(
      streetAddressHasCitySegment(
        "75 Casey St, St. John's, NL A1C 4X6, Canada",
        "St. John's",
      ),
    ).toBe(true)
    expect(
      streetAddressHasCitySegment(
        '75 Casey St, St. John’s, NL A1C 4X6, Canada', // curly apostrophe
        "St. John's",
      ),
    ).toBe(true)
    expect(
      streetAddressHasCitySegment(
        "75 Casey St, St. John's, NL A1C 4X6, Canada",
        'St Johns',
      ),
    ).toBe(true)
  })
})

describe('stripTrailingDuplicateCity', () => {
  it('removes trailing duplicate St. John\'s', () => {
    expect(
      stripTrailingDuplicateCity(
        "75 Casey St, St. John's, NL A1C 4X6, Canada, St. John's",
        "St. John's",
      ),
    ).toBe("75 Casey St, St. John's, NL A1C 4X6, Canada")
  })

  it('keeps a single trailing city', () => {
    expect(
      stripTrailingDuplicateCity("12 Duckworth St, St. John's", "St. John's"),
    ).toBe("12 Duckworth St, St. John's")
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

  it('strips already-duplicated trailing St. John\'s on display', () => {
    expect(
      formatPropertyFullLabel(
        "75 Casey St, St. John's, NL A1C 4X6, Canada, St. John's",
        "St. John's",
      ),
    ).toBe("75 Casey St, St. John's, NL A1C 4X6, Canada")
  })

  it('strips trailing city when apostrophe styles differ', () => {
    expect(
      formatPropertyFullLabel(
        '75 Casey St, St. John’s, NL A1C 4X6, Canada, St. John’s',
        "St. John's",
      ),
    ).toBe('75 Casey St, St. John’s, NL A1C 4X6, Canada')
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

describe('defaultNewPropertyUnit', () => {
  it('creates a vacant unit row the properties list can load', () => {
    expect(defaultNewPropertyUnit('org-1', 'prop-1')).toEqual({
      org_id: 'org-1',
      property_id: 'prop-1',
      unit_number: null,
      bedrooms: 1,
      bathrooms: 1,
      status: 'vacant',
    })
  })

  it('stores a unit letter or number when provided', () => {
    expect(defaultNewPropertyUnit('org-1', 'prop-1', '  A  ').unit_number).toBe('A')
  })
})

describe('sortPropertiesNewestFirst', () => {
  it('puts newest created_at first', () => {
    const rows = [
      { id: 'old', createdAt: '2026-07-01T12:00:00.000Z' },
      { id: 'new', createdAt: '2026-09-01T14:10:00.000Z' },
      { id: 'mid', createdAt: '2026-08-15T09:00:00.000Z' },
    ]
    expect(sortPropertiesNewestFirst(rows).map((r) => r.id)).toEqual(['new', 'mid', 'old'])
  })

  it('sorts missing timestamps last', () => {
    const rows = [
      { id: 'bare' },
      { id: 'new', createdAt: '2026-09-01T14:10:00.000Z' },
    ]
    expect(sortPropertiesNewestFirst(rows).map((r) => r.id)).toEqual(['new', 'bare'])
  })
})
