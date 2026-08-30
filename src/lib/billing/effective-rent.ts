/**
 * Effective (charged) monthly rent after a time-bounded rental credit.
 *
 * Listed monthly rent stays the advertised / lease `monthly_rent`.
 * Until `rentalCreditExpiry` (inclusive, YYYY-MM-DD), charged rent is
 * listed rent minus credit. After expiry, or when credit is 0/empty,
 * charged rent is the full listed rent. A credit with no expiry applies
 * until staff clear the amount.
 */

function money2(n: number): number {
  return Math.round(n * 100) / 100
}

export function creditAppliesOnDate(
  rentalCreditExpiry: string | null | undefined,
  onDate: string,
): boolean {
  const expiry = (rentalCreditExpiry ?? '').trim()
  if (!expiry) return true
  return onDate <= expiry
}

export function effectiveMonthlyRent(input: {
  monthlyRent: number | null | undefined
  rentalCredit?: number | null
  rentalCreditExpiry?: string | null
  onDate: string
}): number {
  const listed = Number(input.monthlyRent)
  if (!Number.isFinite(listed) || listed <= 0) return 0
  const credit = Number(input.rentalCredit ?? 0)
  if (!Number.isFinite(credit) || credit <= 0) return money2(listed)
  if (!creditAppliesOnDate(input.rentalCreditExpiry, input.onDate)) return money2(listed)
  return money2(Math.max(0, listed - credit))
}
