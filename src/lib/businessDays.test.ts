import { describe, it, expect } from 'vitest'
import { addBusinessDays } from './businessDays'

describe('addBusinessDays', () => {
  it('adds 5 business days from Mon Jan 1 2024 → Mon Jan 8 2024', () => {
    // Jan 1 2024 is Monday (New Year's Day — holiday, but we start AFTER it)
    // Starting from Jan 1, count 5 business days:
    // Jan 2 (Tue) = 1, Jan 3 (Wed) = 2, Jan 4 (Thu) = 3, Jan 5 (Fri) = 4, Jan 8 (Mon) = 5
    const result = addBusinessDays(new Date('2024-01-01'), 5)
    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(0) // January
    expect(result.getDate()).toBe(8)
  })

  it('skips Christmas (Dec 25) and Boxing Day (Dec 26) when starting Dec 25 2024', () => {
    // Dec 25 2024 is Wednesday (Christmas — holiday)
    // Starting from Dec 25, count 5 business days:
    // Dec 26 (Thu) = holiday (Boxing Day), skip
    // Dec 27 (Fri) = 1
    // Dec 28 (Sat) = weekend, skip
    // Dec 29 (Sun) = weekend, skip
    // Dec 30 (Mon) = 2
    // Dec 31 (Tue) = 3
    // Jan 1 2025 (Wed) = holiday (New Year's), skip
    // Jan 2 2025 (Thu) = 4
    // Jan 3 2025 (Fri) = 5
    const result = addBusinessDays(new Date('2024-12-25'), 5)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(0) // January
    expect(result.getDate()).toBe(3)
  })

  it('skips Canada Day (Jul 1) when starting Jul 1 2024', () => {
    // Jul 1 2024 is Monday (Canada Day — holiday)
    // Starting from Jul 1, count 1 business day:
    // Jul 2 (Tue) = 1
    const result = addBusinessDays(new Date('2024-07-01'), 1)
    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(6) // July
    expect(result.getDate()).toBe(2)
  })

  it('never returns a Saturday', () => {
    // Friday + 1 business day should be Monday, not Saturday
    const friday = new Date('2024-01-05') // Fri Jan 5 2024
    const result = addBusinessDays(friday, 1)
    expect(result.getDay()).not.toBe(6)
    expect(result.getDay()).toBe(1) // Monday Jan 8
  })

  it('never returns a Sunday', () => {
    // Saturday + 1 business day should be Monday
    const saturday = new Date('2024-01-06') // Sat Jan 6 2024
    const result = addBusinessDays(saturday, 1)
    expect(result.getDay()).not.toBe(0)
    expect(result.getDay()).toBe(1) // Monday Jan 8
  })

  it('skips Labour Day (first Monday of September)', () => {
    // Labour Day 2024 = Sep 2 (first Monday of September)
    // Starting from Sep 1 (Sun), count 1 business day:
    // Sep 2 (Mon) = Labour Day holiday, skip
    // Sep 3 (Tue) = 1
    const result = addBusinessDays(new Date('2024-09-01'), 1)
    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(8) // September
    expect(result.getDate()).toBe(3)
  })

  it('handles 0 business days (returns same date)', () => {
    const date = new Date('2024-03-15') // Friday
    const result = addBusinessDays(date, 0)
    expect(result.getDate()).toBe(15)
  })
})
