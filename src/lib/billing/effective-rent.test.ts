import { describe, expect, it } from 'vitest'
import { creditAppliesOnDate, effectiveMonthlyRent } from './effective-rent'

describe('effectiveMonthlyRent', () => {
  it('returns listed rent when credit is empty or zero', () => {
    expect(effectiveMonthlyRent({ monthlyRent: 1450, rentalCredit: null, onDate: '2026-03-01' })).toBe(1450)
    expect(effectiveMonthlyRent({ monthlyRent: 1450, rentalCredit: 0, onDate: '2026-03-01' })).toBe(1450)
  })

  it('subtracts credit on the expiry date (inclusive)', () => {
    expect(
      effectiveMonthlyRent({
        monthlyRent: 1450,
        rentalCredit: 100,
        rentalCreditExpiry: '2026-03-31',
        onDate: '2026-03-31',
      }),
    ).toBe(1350)
  })

  it('uses full listed rent the day after expiry', () => {
    expect(
      effectiveMonthlyRent({
        monthlyRent: 1450,
        rentalCredit: 100,
        rentalCreditExpiry: '2026-03-31',
        onDate: '2026-04-01',
      }),
    ).toBe(1450)
  })

  it('applies credit indefinitely when expiry is empty', () => {
    expect(
      effectiveMonthlyRent({
        monthlyRent: 1450,
        rentalCredit: 100,
        rentalCreditExpiry: null,
        onDate: '2028-01-01',
      }),
    ).toBe(1350)
  })

  it('does not charge below zero', () => {
    expect(
      effectiveMonthlyRent({
        monthlyRent: 100,
        rentalCredit: 150,
        rentalCreditExpiry: '2026-03-31',
        onDate: '2026-03-01',
      }),
    ).toBe(0)
  })
})

describe('creditAppliesOnDate', () => {
  it('is inclusive on the expiry day', () => {
    expect(creditAppliesOnDate('2026-03-31', '2026-03-31')).toBe(true)
    expect(creditAppliesOnDate('2026-03-31', '2026-04-01')).toBe(false)
  })
})
