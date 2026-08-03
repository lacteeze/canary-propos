import { describe, expect, it } from 'vitest'
import { addMonthsToIsoDate, maxMonthToMonthEndDate, validateLeaseDates } from './lease-term'

describe('addMonthsToIsoDate', () => {
  it('adds 12 months for a typical lease start', () => {
    expect(addMonthsToIsoDate('2026-09-01', 12)).toBe('2027-09-01')
  })

  it('handles month-end clamping', () => {
    expect(addMonthsToIsoDate('2026-01-31', 1)).toBe('2026-03-03')
  })

  it('returns null for invalid dates', () => {
    expect(addMonthsToIsoDate('not-a-date', 12)).toBeNull()
  })
})

describe('maxMonthToMonthEndDate', () => {
  it('is start + 12 months', () => {
    expect(maxMonthToMonthEndDate('2026-03-15')).toBe('2027-03-15')
  })
})

describe('validateLeaseDates', () => {
  it('requires end for fixed-term', () => {
    expect(validateLeaseDates('fixed_term', '2026-09-01', null)).toMatch(/required/i)
    expect(validateLeaseDates('fixed_term', '2026-09-01', '2027-09-01')).toBeNull()
  })
})
