export type LeaseTermType = 'fixed_term' | 'month_to_month'

export const LEASE_TERM_LABELS: Record<LeaseTermType, string> = {
  fixed_term: 'Fixed term',
  month_to_month: 'Month-to-month',
}

const MAX_MONTH_TO_MONTH_MONTHS = 12

function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Latest allowed end date for a month-to-month lease (12 months from start). */
export function maxMonthToMonthEndDate(startDate: string): string | null {
  const start = parseIsoDate(startDate)
  if (!start) return null
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  end.setMonth(end.getMonth() + MAX_MONTH_TO_MONTH_MONTHS)
  const y = end.getFullYear()
  const m = String(end.getMonth() + 1).padStart(2, '0')
  const d = String(end.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function normalizeLeaseTermType(value: string | null | undefined): LeaseTermType {
  const v = (value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (v === 'month_to_month' || v === 'monthly' || v === 'm2m' || v === 'mtm') return 'month_to_month'
  return 'fixed_term'
}

export function validateLeaseDates(
  termType: LeaseTermType,
  startDate: string,
  endDate: string | null | undefined
): string | null {
  if (!parseIsoDate(startDate)) return 'Invalid start date.'
  const end = endDate?.trim() || null

  if (termType === 'fixed_term') {
    if (!end) return 'End date is required for fixed-term leases.'
    if (!parseIsoDate(end)) return 'Invalid end date.'
    if (end <= startDate) return 'End date must be after start date.'
    return null
  }

  if (!end) return null
  if (!parseIsoDate(end)) return 'Invalid end date.'
  if (end <= startDate) return 'End date must be after start date.'
  const maxEnd = maxMonthToMonthEndDate(startDate)
  if (maxEnd && end > maxEnd) return 'Month-to-month end date cannot exceed 12 months from start.'
  return null
}

export function isMonthToMonthLease(termType: LeaseTermType | string | null | undefined): boolean {
  return normalizeLeaseTermType(termType ?? '') === 'month_to_month'
}
