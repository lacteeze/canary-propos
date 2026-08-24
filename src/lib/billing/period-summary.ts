/**
 * Shared billing period math for property / portfolio nets.
 * Positive net = disburse to client; negative = collect from client.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type PeriodExpense = { id: string; description: string; billedAmount: number; subtotal: number }

export type PropertyPeriodSummary = {
  propertyId: string
  propertyAddress: string
  portfolioId: string | null
  ownerName: string
  rentCollected: number
  strGross: number
  strCleaningFees: number
  strMgmtFees: number
  strNetToOwner: number
  expenses: PeriodExpense[]
  totalExpenses: number
  managementFee: number
  managementFeeLabel: string
  /** Signed: rent + STR net − expenses − property mgmt fee − STR cleaning/mgmt charged to owner */
  net: number
  direction: 'disburse' | 'collect' | 'flat'
}

export type PortfolioPeriodSummary = {
  portfolioId: string
  portfolioName: string
  year: number
  month: number
  properties: PropertyPeriodSummary[]
  rentCollected: number
  totalExpenses: number
  managementFees: number
  strNet: number
  net: number
  direction: 'disburse' | 'collect' | 'flat'
  alreadyClosed: boolean
}

function monthDateRange(year: number, month: number): { startIso: string; endIso: string; startDate: string; endDate: string } {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  const startIso = start.toISOString()
  const endIso = end.toISOString()
  return {
    startIso,
    endIso,
    startDate: startIso.slice(0, 10),
    endDate: endIso.slice(0, 10),
  }
}

function managementFee(
  rentCollected: number,
  feeType: 'percent' | 'flat' | null,
  feeValue: number | null
): { fee: number; label: string } {
  if (!feeType || feeValue == null) return { fee: 0, label: 'Management Fee' }
  if (feeType === 'percent') {
    return {
      fee: rentCollected * (feeValue / 100),
      label: `Management Fee (${feeValue}%)`,
    }
  }
  return { fee: feeValue, label: `Management Fee (flat $${feeValue.toFixed(2)})` }
}

function directionFromNet(net: number): 'disburse' | 'collect' | 'flat' {
  if (Math.abs(net) < 0.005) return 'flat'
  return net > 0 ? 'disburse' : 'collect'
}

export async function summarizePropertyPeriod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orgId: string,
  propertyId: string,
  year: number,
  month: number
): Promise<PropertyPeriodSummary | null> {
  const { data: property } = await supabase
    .from('properties')
    .select(
      'id, street_address, city, province, portfolio_id, owner_id, management_fee_type, management_fee_value'
    )
    .eq('id', propertyId)
    .eq('org_id', orgId)
    .single()

  if (!property) return null

  const { startIso, endIso, startDate, endDate } = monthDateRange(year, month)

  const { data: paymentData } = await supabase
    .from('payments')
    .select('amount, status, cleared_at, created_at, leases!inner(units!inner(property_id))')
    .eq('org_id', orgId)
    .eq('leases.units.property_id', propertyId)
    .in('status', ['cleared', 'recorded', 'pending_clearance'])

  const rentCollected = (paymentData ?? []).reduce((sum: number, p: { amount: number; status: string; cleared_at: string | null; created_at: string }) => {
    const when = p.cleared_at || p.created_at
    if (!when || when < startIso || when >= endIso) return sum
    if (p.status === 'failed') return sum
    return sum + Number(p.amount ?? 0)
  }, 0)

  // Owner-visible: subtotal (before HST) + billed_amount (after HST). Cost/markup/labour stay excluded (D-03, D-11).
  const { data: expenseData } = await supabase
    .from('expenses')
    .select('id, description, billed_amount, subtotal')
    .eq('org_id', orgId)
    .eq('property_id', propertyId)
    .gte('expense_date', startDate)
    .lt('expense_date', endDate)

  const expenses: PeriodExpense[] = (expenseData ?? []).map(
    (e: { id: string; description: string; billed_amount: number; subtotal: number }) => ({
      id: e.id,
      description: e.description,
      billedAmount: Number(e.billed_amount ?? 0),
      subtotal: Number(e.subtotal ?? e.billed_amount ?? 0),
    })
  )
  const totalExpenses = expenses.reduce((s, e) => s + e.billedAmount, 0)

  const { data: stays } = await supabase
    .from('hospitable_stays')
    .select('gross_amount, cleaning_fee, management_fee, net_to_owner')
    .eq('org_id', orgId)
    .eq('property_id', propertyId)
    .eq('period_year', year)
    .eq('period_month', month)

  let strGross = 0
  let strCleaningFees = 0
  let strMgmtFees = 0
  let strNetToOwner = 0
  for (const s of stays ?? []) {
    strGross += Number(s.gross_amount ?? 0)
    strCleaningFees += Number(s.cleaning_fee ?? 0)
    strMgmtFees += Number(s.management_fee ?? 0)
    strNetToOwner += Number(s.net_to_owner ?? 0)
  }

  let ownerName = 'Owner'
  if (property.owner_id) {
    const { data: owner } = await supabase
      .from('people')
      .select('first_name, last_name')
      .eq('id', property.owner_id)
      .maybeSingle()
    if (owner) {
      ownerName = `${owner.first_name ?? ''} ${owner.last_name ?? ''}`.trim() || ownerName
    }
  }

  const feeType = (property.management_fee_type as 'percent' | 'flat' | null) ?? null
  const feeValue = property.management_fee_value as number | null
  const { fee: mgmtFee, label: managementFeeLabel } = managementFee(rentCollected, feeType, feeValue)

  // STR cleaning + mgmt are already deducted in net_to_owner; also charge them against owner period.
  const net =
    rentCollected +
    strNetToOwner -
    totalExpenses -
    mgmtFee

  const propertyAddress = `${property.street_address}, ${property.city}, ${property.province}`

  return {
    propertyId: property.id,
    propertyAddress,
    portfolioId: property.portfolio_id,
    ownerName,
    rentCollected,
    strGross,
    strCleaningFees,
    strMgmtFees,
    strNetToOwner,
    expenses,
    totalExpenses,
    managementFee: mgmtFee,
    managementFeeLabel,
    net,
    direction: directionFromNet(net),
  }
}

export async function summarizePortfolioPeriod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orgId: string,
  portfolioId: string,
  year: number,
  month: number
): Promise<PortfolioPeriodSummary | null> {
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id, name')
    .eq('id', portfolioId)
    .eq('org_id', orgId)
    .single()
  if (!portfolio) return null

  const { data: props } = await supabase
    .from('properties')
    .select('id')
    .eq('org_id', orgId)
    .eq('portfolio_id', portfolioId)

  const properties: PropertyPeriodSummary[] = []
  for (const p of props ?? []) {
    const s = await summarizePropertyPeriod(supabase, orgId, p.id, year, month)
    if (s) properties.push(s)
  }

  const rentCollected = properties.reduce((s, p) => s + p.rentCollected, 0)
  const totalExpenses = properties.reduce((s, p) => s + p.totalExpenses, 0)
  const managementFees = properties.reduce((s, p) => s + p.managementFee, 0)
  const strNet = properties.reduce((s, p) => s + p.strNetToOwner, 0)
  const net = properties.reduce((s, p) => s + p.net, 0)

  const { data: closing } = await supabase
    .from('period_closings')
    .select('id')
    .eq('org_id', orgId)
    .eq('portfolio_id', portfolioId)
    .eq('period_year', year)
    .eq('period_month', month)
    .eq('status', 'closed')
    .maybeSingle()

  return {
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    year,
    month,
    properties,
    rentCollected,
    totalExpenses,
    managementFees,
    strNet,
    net,
    direction: directionFromNet(net),
    alreadyClosed: Boolean(closing),
  }
}

export async function leaseOutstandingBalance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orgId: string,
  leaseId: string
): Promise<number> {
  const { data: charges } = await supabase
    .from('charges')
    .select('amount, amount_paid, status')
    .eq('org_id', orgId)
    .eq('lease_id', leaseId)
    .in('status', ['open', 'partial'])

  return (charges ?? []).reduce(
    (sum: number, c: { amount: number; amount_paid: number }) =>
      sum + (Number(c.amount) - Number(c.amount_paid)),
    0
  )
}

export async function projectBalance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orgId: string,
  workOrderId: string
): Promise<{ billed: number; estimate: number | null }> {
  const { data: wo } = await supabase
    .from('work_orders')
    .select('estimated_cost, billed_amount')
    .eq('id', workOrderId)
    .eq('org_id', orgId)
    .maybeSingle()

  const { data: expenses } = await supabase
    .from('expenses')
    .select('billed_amount')
    .eq('org_id', orgId)
    .eq('work_order_id', workOrderId)

  const fromExpenses = (expenses ?? []).reduce(
    (s: number, e: { billed_amount: number }) => s + Number(e.billed_amount ?? 0),
    0
  )
  const billed = fromExpenses || Number(wo?.billed_amount ?? 0)
  return {
    billed,
    estimate: wo?.estimated_cost != null ? Number(wo.estimated_cost) : null,
  }
}

export { monthDateRange, managementFee, directionFromNet }
