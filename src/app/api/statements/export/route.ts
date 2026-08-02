// GET /api/statements/export?scope=portfolio|property|lease&id=&year=&month=&format=csv|pdf
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import {
  summarizePortfolioPeriod,
  summarizePropertyPeriod,
  leaseOutstandingBalance,
  monthDateRange,
} from '@/lib/billing/period-summary'
import { ClientStatementPDF } from '@/components/payments/ClientStatementPDF'
import { StatementPDF } from '@/components/payments/StatementPDF'

export const runtime = 'nodejs'

const querySchema = z.object({
  scope: z.enum(['portfolio', 'property', 'lease']),
  id: z.string().uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  format: z.enum(['csv', 'pdf']).default('csv'),
})

function csvEscape(v: string | number): string {
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  if (!person) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const roles = (person.role as unknown as string[]) ?? []
  if (!roles.includes('manager') && !roles.includes('admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  }
  const { scope, id, year, month, format } = parsed.data
  const orgId = person.org_id

  if (scope === 'portfolio') {
    const summary = await summarizePortfolioPeriod(supabase, orgId, id, year, month)
    if (!summary) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (format === 'csv') {
      const lines = [
        ['property', 'rent_collected', 'expenses', 'management_fee', 'str_net', 'net'].join(','),
        ...summary.properties.map((p) =>
          [
            csvEscape(p.propertyAddress),
            p.rentCollected,
            p.totalExpenses,
            p.managementFee,
            p.strNetToOwner,
            p.net,
          ].join(',')
        ),
        ['TOTAL', summary.rentCollected, summary.totalExpenses, summary.managementFees, summary.strNet, summary.net].join(','),
      ]
      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="portfolio-${year}-${month}.csv"`,
        },
      })
    }

    const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
    const direction = summary.direction === 'collect' ? 'collect' : 'disburse'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(ClientStatementPDF, {
        data: {
          orgName: org?.name ?? 'Canary PM',
          portfolioName: summary.portfolioName,
          periodYear: year,
          periodMonth: month,
          direction,
          netAmount: Math.abs(summary.net),
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
        },
      }) as any
    )
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="portfolio-${year}-${month}.pdf"`,
      },
    })
  }

  if (scope === 'property') {
    const summary = await summarizePropertyPeriod(supabase, orgId, id, year, month)
    if (!summary) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (format === 'csv') {
      const lines = [
        ['line', 'amount'].join(','),
        ['rent_collected', summary.rentCollected].join(','),
        ['str_net', summary.strNetToOwner].join(','),
        ...summary.expenses.map((e) => [csvEscape(e.description), e.billedAmount].join(',')),
        [csvEscape(summary.managementFeeLabel), summary.managementFee].join(','),
        ['net', summary.net].join(','),
      ]
      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="property-${year}-${month}.csv"`,
        },
      })
    }

    const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(StatementPDF, {
        statement: {
          orgName: org?.name ?? 'Canary PM',
          propertyAddress: summary.propertyAddress,
          ownerName: summary.ownerName,
          periodYear: year,
          periodMonth: month,
          rentCollected: summary.rentCollected,
          expenses: summary.expenses,
          managementFeeLabel: summary.managementFeeLabel,
          managementFee: summary.managementFee,
          netToOwner: summary.net,
        },
      }) as any
    )
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="property-${year}-${month}.pdf"`,
      },
    })
  }

  // lease
  const { startDate, endDate } = monthDateRange(year, month)
  const { data: lease } = await supabase
    .from('leases')
    .select(
      'id, monthly_rent, people!tenant_id(first_name, last_name), units!unit_id(properties!property_id(street_address, city))'
    )
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (!lease) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: charges } = await supabase
    .from('charges')
    .select('due_date, type, amount, amount_paid, status, notes')
    .eq('lease_id', id)
    .eq('org_id', orgId)
    .eq('period_year', year)
    .eq('period_month', month)

  const { data: payments } = await supabase
    .from('payments')
    .select('amount, method, status, created_at, notes')
    .eq('lease_id', id)
    .eq('org_id', orgId)
    .gte('created_at', `${startDate}T00:00:00.000Z`)
    .lt('created_at', `${endDate}T00:00:00.000Z`)

  const balance = await leaseOutstandingBalance(supabase, orgId, id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pe = lease.people as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prop = (lease.units as any)?.properties
  const tenant = pe ? `${pe.first_name ?? ''} ${pe.last_name ?? ''}`.trim() : 'Tenant'
  const address = prop ? `${prop.street_address}` : 'Property'

  const lines = [
    ['section', 'date', 'description', 'amount', 'status'].join(','),
    ...(charges ?? []).map((c) =>
      [
        'charge',
        c.due_date,
        csvEscape(c.notes || c.type),
        c.amount,
        c.status,
      ].join(',')
    ),
    ...(payments ?? []).map((p) =>
      [
        'payment',
        p.created_at?.slice(0, 10) || '',
        csvEscape(p.notes || p.method),
        p.amount,
        p.status,
      ].join(',')
    ),
    ['balance', '', csvEscape(`${tenant} @ ${address}`), balance, 'outstanding'].join(','),
  ]

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lease-${year}-${month}.csv"`,
    },
  })
}
