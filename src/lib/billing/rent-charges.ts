/**
 * Auto-generate monthly rent charges for active (incl. UI "expiring") leases.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveMonthlyRent } from './effective-rent'

export type RentChargeGenerateResult = {
  created: number
  skipped: number
  errors: string[]
}

function dueDateForPeriod(year: number, month: number, rentDueDay: number): string {
  const day = Math.min(Math.max(rentDueDay || 1, 1), 28)
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function leaseCoversPeriod(
  startDate: string,
  endDate: string | null,
  year: number,
  month: number
): boolean {
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  if (startDate >= periodEnd) return false
  if (endDate && endDate < periodStart) return false
  return true
}

/** Active leases, plus any still covering the period that are not terminated/expired. */
export async function generateRentChargesForOrg(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orgId: string,
  year: number,
  month: number
): Promise<RentChargeGenerateResult> {
  const result: RentChargeGenerateResult = { created: 0, skipped: 0, errors: [] }

  const { data: leases, error } = await supabase
    .from('leases')
    .select(
      'id, monthly_rent, rental_credit, rental_credit_expiry, rent_due_day, status, start_date, end_date, unit_id, units!unit_id(property_id, properties!property_id(portfolio_id))'
    )
    .eq('org_id', orgId)
    .in('status', ['active'])

  if (error) {
    result.errors.push(error.message)
    return result
  }

  for (const lease of leases ?? []) {
    if (!leaseCoversPeriod(lease.start_date, lease.end_date, year, month)) {
      result.skipped++
      continue
    }
    const dueDate = dueDateForPeriod(year, month, lease.rent_due_day ?? 1)
    const amount = effectiveMonthlyRent({
      monthlyRent: lease.monthly_rent,
      rentalCredit: lease.rental_credit,
      rentalCreditExpiry: lease.rental_credit_expiry,
      onDate: dueDate,
    })
    if (!amount || amount <= 0) {
      result.skipped++
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unit = lease.units as any
    const propertyId = unit?.property_id as string | undefined
    const portfolioId = (unit?.properties?.portfolio_id as string | null) ?? null
    if (!propertyId) {
      result.skipped++
      continue
    }

    const { error: insertError } = await supabase.from('charges').insert({
      org_id: orgId,
      lease_id: lease.id,
      property_id: propertyId,
      portfolio_id: portfolioId,
      type: 'rent',
      amount,
      amount_paid: 0,
      due_date: dueDate,
      period_year: year,
      period_month: month,
      status: 'open',
      notes: `Rent ${year}-${String(month).padStart(2, '0')}`,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        result.skipped++
      } else {
        result.errors.push(`${lease.id}: ${insertError.message}`)
      }
      continue
    }
    result.created++
  }

  return result
}

export async function generateRentChargesForAllOrgs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  year?: number,
  month?: number
): Promise<{ orgs: number; created: number; skipped: number; errors: string[] }> {
  const now = new Date()
  const y = year ?? now.getUTCFullYear()
  const m = month ?? now.getUTCMonth() + 1

  const { data: orgs } = await supabase.from('organizations').select('id')
  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const org of orgs ?? []) {
    const r = await generateRentChargesForOrg(supabase, org.id, y, m)
    created += r.created
    skipped += r.skipped
    errors.push(...r.errors)
  }

  return { orgs: (orgs ?? []).length, created, skipped, errors }
}

/** Apply a payment to open charges FIFO for its lease. */
export async function allocatePaymentToCharges(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orgId: string,
  paymentId: string,
  leaseId: string,
  paymentAmount: number
): Promise<void> {
  let remaining = paymentAmount
  if (remaining <= 0) return

  const { data: charges } = await supabase
    .from('charges')
    .select('id, amount, amount_paid, status')
    .eq('org_id', orgId)
    .eq('lease_id', leaseId)
    .in('status', ['open', 'partial'])
    .order('due_date', { ascending: true })

  for (const charge of charges ?? []) {
    if (remaining <= 0) break
    const open = Number(charge.amount) - Number(charge.amount_paid)
    if (open <= 0) continue
    const apply = Math.min(open, remaining)
    const newPaid = Number(charge.amount_paid) + apply
    const status = newPaid >= Number(charge.amount) - 0.001 ? 'paid' : 'partial'

    await supabase.from('payment_allocations').insert({
      org_id: orgId,
      payment_id: paymentId,
      charge_id: charge.id,
      amount: apply,
    })

    await supabase
      .from('charges')
      .update({ amount_paid: newPaid, status, updated_at: new Date().toISOString() })
      .eq('id', charge.id)
      .eq('org_id', orgId)

    remaining -= apply
  }
}
