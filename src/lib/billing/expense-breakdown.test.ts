import { describe, it, expect } from 'vitest'
import { computeExpenseBilling, DEFAULT_EXPENSE_RATES } from './expense-breakdown'

describe('computeExpenseBilling', () => {
  it('matches the locked 48.62 supplies + 2 hours example', () => {
    const result = computeExpenseBilling({
      suppliesCost: 48.62,
      labourHours: 2,
      rates: DEFAULT_EXPENSE_RATES,
    })
    expect(result.suppliesMarkedUp).toBe(63.21)
    expect(result.labourAmount).toBe(100)
    expect(result.subtotal).toBe(163.21)
    expect(result.hstAmount).toBe(24.48)
    expect(result.total).toBe(187.69)
    expect(result.markupAmount).toBe(14.59)
  })

  it('bills labour-only: 0 supplies + 2 hours', () => {
    const result = computeExpenseBilling({
      suppliesCost: 0,
      labourHours: 2,
      rates: DEFAULT_EXPENSE_RATES,
    })
    expect(result.labourAmount).toBe(100)
    expect(result.subtotal).toBe(100)
    expect(result.hstAmount).toBe(15)
    expect(result.total).toBe(115)
  })

  it('bills supplies-only: $10 supplies + 0 hours', () => {
    const result = computeExpenseBilling({
      suppliesCost: 10,
      labourHours: 0,
      rates: DEFAULT_EXPENSE_RATES,
    })
    expect(result.suppliesMarkedUp).toBe(13)
    expect(result.subtotal).toBe(13)
    expect(result.hstAmount).toBe(1.95)
    expect(result.total).toBe(14.95)
  })

  it('round2 uses cent rounding (1.005 → 1.01)', () => {
    const result = computeExpenseBilling({
      suppliesCost: 0,
      labourHours: 1.005 / 50,
      rates: DEFAULT_EXPENSE_RATES,
    })
    expect(result.labourAmount).toBe(1.01)
  })
})
