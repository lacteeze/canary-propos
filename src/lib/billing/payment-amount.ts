export type OpenChargeBalance = {
  amount: number
  amount_paid?: number | null
}

/** Remaining cents due from open charges, or listed monthly rent when none are open. */
export function paymentAmountCents(input: {
  openCharges: OpenChargeBalance[]
  monthlyRent: number | null | undefined
}): number {
  const dueDollars = input.openCharges.reduce((sum, charge) => {
    const remaining = Number(charge.amount) - Number(charge.amount_paid ?? 0)
    if (!Number.isFinite(remaining) || remaining <= 0) return sum
    return sum + remaining
  }, 0)

  if (dueDollars > 0) return Math.round(dueDollars * 100)

  const rent = Number(input.monthlyRent)
  if (!Number.isFinite(rent) || rent <= 0) return 0
  return Math.round(rent * 100)
}
