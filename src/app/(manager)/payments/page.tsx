// src/app/(manager)/payments/page.tsx
// Manager payments overview — lists all org payments with CSV export (PAY-08)
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const METHOD_LABELS: Record<string, string> = {
  stripe: 'Online (Card)',
  etransfer: 'Interac e-Transfer',
  cheque: 'Cheque',
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
}

const STATUS_LABELS: Record<string, string> = {
  recorded: 'Recorded',
  pending_clearance: 'Pending Clearance',
  cleared: 'Cleared',
  failed: 'Failed',
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function statusBadgeClass(status: string): string {
  if (status === 'cleared') return 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700'
  if (status === 'pending_clearance') return 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700'
  if (status === 'failed') return 'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700'
  return 'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600'
}

export default async function PaymentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: callerPerson } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) redirect('/login')

  const isManager = callerPerson.role.includes('manager') || callerPerson.role.includes('admin')
  if (!isManager) redirect('/login')

  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id,
      amount,
      method,
      status,
      created_at,
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Payments</h1>
          <p className="mt-1 text-sm text-stone-500">All recorded payments across your portfolio.</p>
        </div>
        <a
          href="/payments/export"
          download
          className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Export CSV
        </a>
      </div>

      {(!payments || payments.length === 0) ? (
        <div className="rounded-xl border border-dashed border-stone-200 px-8 py-16 text-center">
          <h2 className="mb-2 text-base font-semibold text-stone-900">No payments recorded</h2>
          <p className="text-sm text-stone-500">Payments will appear here once recorded against a lease.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {payments.map((payment) => {
                  const lease = Array.isArray(payment.leases) ? payment.leases[0] : payment.leases
                  const tenant = lease ? (Array.isArray(lease.people) ? lease.people[0] : lease.people) : null
                  const unit = lease ? (Array.isArray(lease.units) ? lease.units[0] : lease.units) : null
                  const property = unit ? (Array.isArray(unit.properties) ? unit.properties[0] : unit.properties) : null
                  const tenantName = tenant ? `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() : '—'
                  const propertyDisplay = property
                    ? `${property.street_address}${unit?.unit_number ? ` · Unit ${unit.unit_number}` : ''}`
                    : '—'
                  return (
                    <tr key={payment.id} className="bg-white hover:bg-stone-50">
                      <td className="px-4 py-3 text-stone-600">{formatDate(payment.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-stone-900">{tenantName}</td>
                      <td className="px-4 py-3 text-stone-600">{propertyDisplay}</td>
                      <td className="px-4 py-3 font-medium text-stone-900">{formatCurrency(Number(payment.amount))}</td>
                      <td className="px-4 py-3 text-stone-600">{METHOD_LABELS[payment.method] ?? payment.method}</td>
                      <td className="px-4 py-3">
                        <span className={statusBadgeClass(payment.status)}>
                          {STATUS_LABELS[payment.status] ?? payment.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {payments.map((payment) => {
              const lease = Array.isArray(payment.leases) ? payment.leases[0] : payment.leases
              const tenant = lease ? (Array.isArray(lease.people) ? lease.people[0] : lease.people) : null
              const tenantName = tenant ? `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() : '—'
              return (
                <div key={payment.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <p className="font-medium text-stone-900">{formatCurrency(Number(payment.amount))}</p>
                    <span className={statusBadgeClass(payment.status)}>
                      {STATUS_LABELS[payment.status] ?? payment.status}
                    </span>
                  </div>
                  <p className="mb-1 text-sm text-stone-600">{tenantName}</p>
                  <p className="text-xs text-stone-400">{formatDate(payment.created_at)} · {METHOD_LABELS[payment.method] ?? payment.method}</p>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
