import { describe, expect, it } from 'vitest'
import { paymentAmountCents } from './payment-amount'

describe('paymentAmountCents', () => {
  it('sums remaining balances on open charges', () => {
    expect(
      paymentAmountCents({
        openCharges: [
          { amount: 1450, amount_paid: 0 },
          { amount: 80, amount_paid: 20 },
        ],
        monthlyRent: 1450,
      }),
    ).toBe(151000)
  })

  it('ignores charges that are already paid', () => {
    expect(
      paymentAmountCents({
        openCharges: [{ amount: 1450, amount_paid: 1450 }],
        monthlyRent: 1450,
      }),
    ).toBe(145000)
  })

  it('falls back to monthly rent when there are no open balances', () => {
    expect(
      paymentAmountCents({
        openCharges: [],
        monthlyRent: 1600.5,
      }),
    ).toBe(160050)
  })

  it('returns 0 when nothing is due and rent is missing', () => {
    expect(paymentAmountCents({ openCharges: [], monthlyRent: null })).toBe(0)
    expect(paymentAmountCents({ openCharges: [], monthlyRent: 0 })).toBe(0)
  })
})
