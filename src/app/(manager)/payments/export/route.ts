// src/app/(manager)/payments/export/route.ts
// CSV export of all org payments — manager-only (PAY-08)
// vendor_cost is intentionally excluded from SELECT
import { createClient } from '@/lib/supabase/server'

function csvEscape(value: string): string {
  // Quote field if it contains comma, double-quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export async function GET() {
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 2. Resolve person + role
  const { data: callerPerson } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 3. Manager/admin role check
  if (!callerPerson.role.includes('manager') && !callerPerson.role.includes('admin')) {
    return new Response('Forbidden', { status: 403 })
  }

  // 4. Query payments with full join — org_id scopes to manager's org
  // vendor_cost is NOT in SELECT (intentional — internal data)
  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      created_at,
      amount,
      method,
      status,
      notes,
      leases!lease_id(
        people!tenant_id( first_name, last_name ),
        units!unit_id(
          unit_number,
          properties!property_id( street_address, city )
        )
      )
    `)
    .eq('org_id', callerPerson.org_id)
    .order('created_at', { ascending: false })

  if (error) {
    return new Response('Internal Server Error', { status: 500 })
  }

  // 5. Build CSV
  const rows: string[] = [
    'Date,Tenant,Property,Unit,Amount,Method,Status,Notes',
  ]

  for (const payment of payments ?? []) {
    const lease = Array.isArray(payment.leases) ? payment.leases[0] : payment.leases
    const tenant = lease ? (Array.isArray(lease.people) ? lease.people[0] : lease.people) : null
    const unit = lease ? (Array.isArray(lease.units) ? lease.units[0] : lease.units) : null
    const property = unit ? (Array.isArray(unit.properties) ? unit.properties[0] : unit.properties) : null

    const date = payment.created_at.slice(0, 10) // YYYY-MM-DD
    const tenantName = tenant
      ? `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim()
      : ''
    const propertyAddress = property?.street_address ?? ''
    const unitNumber = unit?.unit_number ?? ''
    const amount = Number(payment.amount).toFixed(2)
    const method = payment.method ?? ''
    const status = payment.status ?? ''
    const notes = payment.notes ?? ''

    rows.push([
      csvEscape(date),
      csvEscape(tenantName),
      csvEscape(propertyAddress),
      csvEscape(unitNumber),
      csvEscape(amount),
      csvEscape(method),
      csvEscape(status),
      csvEscape(notes),
    ].join(','))
  }

  const csvString = rows.join('\n')
  const today = new Date().toISOString().slice(0, 10)

  return new Response(csvString, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payments-export-${today}.csv"`,
    },
  })
}
