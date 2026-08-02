'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  leaseOutstandingBalance,
  summarizePortfolioPeriod,
  summarizePropertyPeriod,
  type PortfolioPeriodSummary,
  type PropertyPeriodSummary,
} from '@/lib/billing/period-summary'
import {
  allocatePaymentToCharges,
  generateRentChargesForOrg,
} from '@/lib/billing/rent-charges'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import {
  ClientStatementPDF,
  type ClientStatementData,
} from '@/components/payments/ClientStatementPDF'

type ActionResult = { success: true } | { success: false; error: string }

async function getManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  if (!person) return null
  const roles = (person.role as unknown as string[]) ?? []
  if (!roles.includes('manager') && !roles.includes('admin')) return null
  return { supabase, person }
}

export async function getBillingDashboard(input: {
  year: number
  month: number
  portfolioId?: string | null
}): Promise<{
  portfolios: { id: string; name: string }[]
  portfolioSummary: PortfolioPeriodSummary | null
  leaseBalances: Array<{
    leaseId: string
    property: string
    tenant: string
    balance: number
  }>
  projectBalances: Array<{
    projectId: string
    name: string
    property: string
    billed: number
    estimate: number | null
  }>
}> {
  const ctx = await getManager()
  if (!ctx) {
    return { portfolios: [], portfolioSummary: null, leaseBalances: [], projectBalances: [] }
  }

  const { data: portfolios } = await ctx.supabase
    .from('portfolios')
    .select('id, name')
    .eq('org_id', ctx.person.org_id)
    .order('name')

  const portfolioId = input.portfolioId || portfolios?.[0]?.id || null
  const portfolioSummary = portfolioId
    ? await summarizePortfolioPeriod(
        ctx.supabase,
        ctx.person.org_id,
        portfolioId,
        input.year,
        input.month
      )
    : null

  const { data: leases } = await ctx.supabase
    .from('leases')
    .select(
      'id, status, monthly_rent, people!tenant_id(first_name, last_name), units!unit_id(properties!property_id(street_address, city))'
    )
    .eq('org_id', ctx.person.org_id)
    .eq('status', 'active')
    .limit(200)

  const leaseBalances: Array<{
    leaseId: string
    property: string
    tenant: string
    balance: number
  }> = []

  for (const lease of leases ?? []) {
    const balance = await leaseOutstandingBalance(ctx.supabase, ctx.person.org_id, lease.id)
    if (balance <= 0.01) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pe = lease.people as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prop = (lease.units as any)?.properties
    leaseBalances.push({
      leaseId: lease.id,
      property: prop
        ? `${prop.street_address}${prop.city ? `, ${prop.city}` : ''}`
        : '—',
      tenant: pe
        ? `${pe.first_name ?? ''} ${pe.last_name ?? ''}`.trim() || 'Tenant'
        : 'Tenant',
      balance,
    })
  }
  leaseBalances.sort((a, b) => b.balance - a.balance)

  const { data: projects } = await ctx.supabase
    .from('work_orders')
    .select('id, title, estimated_cost, billed_amount, properties!property_id(street_address)')
    .eq('org_id', ctx.person.org_id)
    .not('status', 'eq', 'closed')
    .limit(100)

  const projectBalances = (projects ?? []).map((pj) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prop = pj.properties as any
    return {
      projectId: pj.id,
      name: pj.title,
      property: prop?.street_address || '—',
      billed: Number(pj.billed_amount ?? 0),
      estimate: pj.estimated_cost != null ? Number(pj.estimated_cost) : null,
    }
  })

  return {
    portfolios: (portfolios ?? []).map((p) => ({ id: p.id, name: p.name })),
    portfolioSummary,
    leaseBalances,
    projectBalances,
  }
}

export async function generateChargesForMonth(year: number, month: number): Promise<
  ActionResult & { created?: number; skipped?: number }
> {
  const ctx = await getManager()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  const result = await generateRentChargesForOrg(
    ctx.supabase,
    ctx.person.org_id,
    year,
    month
  )
  revalidatePath('/billing')
  revalidatePath('/app')
  if (result.errors.length && result.created === 0) {
    return { success: false, error: result.errors.slice(0, 3).join('; ') }
  }
  return { success: true, created: result.created, skipped: result.skipped }
}

export async function closePortfolioMonth(input: {
  portfolioId: string
  year: number
  month: number
}): Promise<
  | { success: true; closingId: string; pdfPath: string | null; direction: string; net: number }
  | { success: false; error: string }
> {
  const ctx = await getManager()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  const summary = await summarizePortfolioPeriod(
    ctx.supabase,
    ctx.person.org_id,
    input.portfolioId,
    input.year,
    input.month
  )
  if (!summary) return { success: false, error: 'Portfolio not found.' }
  if (summary.alreadyClosed) return { success: false, error: 'This month is already closed.' }

  const direction = summary.direction === 'collect' ? 'collect' : 'disburse'
  const absNet = Math.abs(summary.net)

  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('name')
    .eq('id', ctx.person.org_id)
    .single()

  const statementData: ClientStatementData = {
    orgName: org?.name ?? 'Canary PM',
    portfolioName: summary.portfolioName,
    periodYear: input.year,
    periodMonth: input.month,
    direction,
    netAmount: absNet,
    rentCollected: summary.rentCollected,
    totalExpenses: summary.totalExpenses,
    managementFees: summary.managementFees,
    strNet: summary.strNet,
    properties: summary.properties.map((p) => ({
      address: p.propertyAddress,
      rentCollected: p.rentCollected,
      expenses: p.totalExpenses,
      managementFee: p.managementFee,
      strNet: p.strNetToOwner,
      net: p.net,
    })),
  }

  let pdfPath: string | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(ClientStatementPDF, { data: statementData }) as any
    )
    const admin = createAdminClient()
    const path = `${ctx.person.org_id}/statements/portfolio/${input.portfolioId}/${input.year}-${String(input.month).padStart(2, '0')}.pdf`
    const { error: uploadError } = await admin.storage
      .from('org-assets')
      .upload(path, buffer, { contentType: 'application/pdf', upsert: true })
    if (!uploadError) pdfPath = path
  } catch (err) {
    console.warn('[closePortfolioMonth] PDF failed', err)
  }

  const { data: closing, error } = await ctx.supabase
    .from('period_closings')
    .insert({
      org_id: ctx.person.org_id,
      portfolio_id: input.portfolioId,
      period_year: input.year,
      period_month: input.month,
      status: 'closed',
      net_amount: absNet,
      direction,
      statement_pdf_path: pdfPath,
      closed_by: ctx.person.id,
    })
    .select('id')
    .single()

  if (error || !closing) {
    return { success: false, error: error?.message || 'Failed to close month.' }
  }

  revalidatePath('/billing')
  return {
    success: true,
    closingId: closing.id,
    pdfPath,
    direction,
    net: absNet,
  }
}

export async function getPropertyPeriodSummary(
  propertyId: string,
  year: number,
  month: number
): Promise<PropertyPeriodSummary | null> {
  const ctx = await getManager()
  if (!ctx) return null
  return summarizePropertyPeriod(ctx.supabase, ctx.person.org_id, propertyId, year, month)
}

const hospitableRowSchema = z.object({
  reservation_code: z.string().min(1),
  property_address: z.string().optional(),
  hospitable_property_id: z.string().optional(),
  guest_name: z.string().optional(),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
  nights: z.coerce.number().optional(),
  gross_amount: z.coerce.number(),
  cleaning_fee_rate: z.coerce.number().optional(),
  cleaning_fee: z.coerce.number().optional(),
  management_fee_percent: z.coerce.number().optional(),
  management_fee: z.coerce.number().optional(),
})

export async function importHospitableStaysCsv(
  rows: Record<string, string>[],
  defaults?: { cleaningFeeFlat?: number; managementFeePercent?: number }
): Promise<{ success: true; imported: number; skipped: number; errors: string[] } | { success: false; error: string }> {
  const ctx = await getManager()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  const { data: properties } = await ctx.supabase
    .from('properties')
    .select('id, street_address, city, portfolio_id')
    .eq('org_id', ctx.person.org_id)

  const { data: units } = await ctx.supabase
    .from('units')
    .select('property_id, hospitable_property_id')
    .eq('org_id', ctx.person.org_id)
    .not('hospitable_property_id', 'is', null)

  const byHosp = new Map(
    (units ?? [])
      .filter((u) => u.hospitable_property_id && u.property_id)
      .map((u) => [u.hospitable_property_id!.toLowerCase(), u.property_id!])
  )

  let imported = 0
  let skipped = 0
  const errors: string[] = []
  const cleanFlat = defaults?.cleaningFeeFlat ?? 0
  const mgmtPct = defaults?.managementFeePercent ?? 0

  for (const raw of rows) {
    const normalized: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      normalized[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim()
    }

    const candidate = {
      reservation_code:
        normalized.reservation_code ||
        normalized.code ||
        normalized.confirmation_code ||
        normalized.reservation,
      property_address: normalized.property_address || normalized.property || normalized.address,
      hospitable_property_id:
        normalized.hospitable_property_id || normalized.property_id || normalized.listing_id,
      guest_name: normalized.guest_name || normalized.guest,
      check_in: normalized.check_in || normalized.checkin || normalized.arrival,
      check_out: normalized.check_out || normalized.checkout || normalized.departure,
      nights: normalized.nights,
      gross_amount:
        normalized.gross_amount ||
        normalized.gross ||
        normalized.payout ||
        normalized.revenue ||
        normalized.amount,
      cleaning_fee: normalized.cleaning_fee || normalized.cleaning,
      cleaning_fee_rate: normalized.cleaning_fee_rate,
      management_fee: normalized.management_fee || normalized.mgmt_fee,
      management_fee_percent: normalized.management_fee_percent || normalized.mgmt_percent,
    }

    const parsed = hospitableRowSchema.safeParse(candidate)
    if (!parsed.success) {
      skipped++
      errors.push(`Row skipped: ${parsed.error.issues[0]?.message || 'invalid'}`)
      continue
    }
    const row = parsed.data

    let propertyId: string | null = null
    if (row.hospitable_property_id) {
      propertyId = byHosp.get(row.hospitable_property_id.toLowerCase()) ?? null
    }
    if (!propertyId && row.property_address) {
      const needle = row.property_address.toLowerCase()
      const match = (properties ?? []).find(
        (p) =>
          p.street_address.toLowerCase().includes(needle) ||
          needle.includes(p.street_address.toLowerCase()) ||
          `${p.street_address}, ${p.city}`.toLowerCase() === needle
      )
      propertyId = match?.id ?? null
    }

    const prop = (properties ?? []).find((p) => p.id === propertyId)
    const gross = row.gross_amount
    const cleaning =
      row.cleaning_fee != null
        ? row.cleaning_fee
        : row.cleaning_fee_rate != null
          ? row.cleaning_fee_rate
          : cleanFlat
    const mgmt =
      row.management_fee != null
        ? row.management_fee
        : ((row.management_fee_percent ?? mgmtPct) / 100) * gross
    const net = gross - cleaning - mgmt

    let periodYear: number | null = null
    let periodMonth: number | null = null
    if (row.check_out) {
      const d = new Date(row.check_out)
      if (!Number.isNaN(d.getTime())) {
        periodYear = d.getUTCFullYear()
        periodMonth = d.getUTCMonth() + 1
      }
    }

    const { error } = await ctx.supabase.from('hospitable_stays').upsert(
      {
        org_id: ctx.person.org_id,
        property_id: propertyId,
        portfolio_id: prop?.portfolio_id ?? null,
        reservation_code: row.reservation_code,
        guest_name: row.guest_name ?? null,
        check_in: row.check_in || null,
        check_out: row.check_out || null,
        nights: row.nights ?? null,
        gross_amount: gross,
        cleaning_fee: cleaning,
        management_fee: mgmt,
        net_to_owner: net,
        period_year: periodYear,
        period_month: periodMonth,
        raw: normalized,
      },
      { onConflict: 'org_id,reservation_code' }
    )

    if (error) {
      errors.push(`${row.reservation_code}: ${error.message}`)
      skipped++
    } else {
      imported++
    }
  }

  revalidatePath('/billing')
  return { success: true, imported, skipped, errors: errors.slice(0, 20) }
}

export async function allocatePaymentAction(
  paymentId: string
): Promise<ActionResult> {
  const ctx = await getManager()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  const { data: payment } = await ctx.supabase
    .from('payments')
    .select('id, lease_id, amount')
    .eq('id', paymentId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!payment?.lease_id) return { success: false, error: 'Payment not found.' }

  await allocatePaymentToCharges(
    ctx.supabase,
    ctx.person.org_id,
    payment.id,
    payment.lease_id,
    Number(payment.amount)
  )
  return { success: true }
}
