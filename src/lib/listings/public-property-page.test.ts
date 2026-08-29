import { describe, expect, it } from 'vitest'
import {
  formatListingLeaseEnd,
  propertyAvailabilityLabel,
  publishedListingIsListed,
  unitLooksLeased,
} from './public-property-page'

describe('unitLooksLeased', () => {
  it('treats occupied and leased as leased', () => {
    expect(unitLooksLeased('occupied')).toBe(true)
    expect(unitLooksLeased('Leased')).toBe(true)
  })

  it('does not treat short-term or vacant units as leased', () => {
    expect(unitLooksLeased('str')).toBe(false)
    expect(unitLooksLeased('vacant')).toBe(false)
    expect(unitLooksLeased(null)).toBe(false)
  })
})

describe('propertyAvailabilityLabel', () => {
  it('never includes a calendar date', () => {
    expect(propertyAvailabilityLabel(true)).toBe('Currently leased')
    expect(propertyAvailabilityLabel(false)).toBe('Not currently available')
    expect(propertyAvailabilityLabel(true)).not.toMatch(/\d{4}/)
  })
})

describe('formatListingLeaseEnd', () => {
  it('formats a date-only ISO string with the year', () => {
    expect(formatListingLeaseEnd('2026-09-30')).toMatch(/Sep/)
    expect(formatListingLeaseEnd('2026-09-30')).toMatch(/30/)
    expect(formatListingLeaseEnd('2026-09-30')).toMatch(/2026/)
  })

  it('returns null for missing or invalid dates', () => {
    expect(formatListingLeaseEnd(null)).toBeNull()
    expect(formatListingLeaseEnd('')).toBeNull()
    expect(formatListingLeaseEnd('not-a-date')).toBeNull()
  })
})

describe('publishedListingIsListed', () => {
  it('treats published listings as listed even when the unit is occupied', () => {
    expect(publishedListingIsListed('published')).toBe(true)
    expect(publishedListingIsListed('Published')).toBe(true)
  })

  it('does not treat draft or unlisted homes as listed', () => {
    expect(publishedListingIsListed('draft')).toBe(false)
    expect(publishedListingIsListed('unlisted')).toBe(false)
    expect(publishedListingIsListed(null)).toBe(false)
  })
})
