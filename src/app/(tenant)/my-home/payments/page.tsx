// src/app/(tenant)/my-home/payments/page.tsx
// Tenant payment history — all payments on active lease(s), with receipt links
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

export default async function PaymentHistoryPage() {
  const supabase = await createClient()

  // 1. Session guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Resolve person row
  const { data: person } = await supabase
    .from('people')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  if (!person) redirect('/login')
  if (!person.role.includes('tenant')) redirect('/login')

  // 3. Get active lease IDs for this tenant
  const { data: leases } = await supabase
    .from('leases')
    .select('id')
    .eq('tenant_id', person.id)
    .eq('status', 'active')

  const leaseIds = (leases ?? []).map((l) => l.id)

  // 4. Load payments (RLS also enforces this)
  const { data: payments } = leaseIds.length > 0
    ? await supabase
        .from('payments')
        .select('id, amount, method, status, created_at, notes')
        .in('lease_id', leaseIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Payment History</h1>
          <p className="mt-1 text-sm text-stone-500">All payments on your active lease.</p>
        </div>
        <Link
          href="/my-home"
          className="text-sm text-stone-500 underline underline-offset-2 hover:text-stone-800"
        >
          Back to My Home
        </Link>
      </div>

      {!payments || payments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center">
          <p className="text-base font-medium text-stone-700">No payment history yet.</p>
          <p className="mt-1 text-sm text-stone-500">
            Payments will appear here once recorded by your property manager.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table (md+) */}
          <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="bg-white hover:bg-stone-50">
                    <td className="px-4 py-3 text-stone-600">{formatDate(payment.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-stone-900">{formatCurrency(Number(payment.amount))}</td>
                    <td className="px-4 py-3 text-stone-600">{METHOD_LABELS[payment.method] ?? payment.method}</td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass(payment.status)}>
                        {STATUS_LABELS[payment.status] ?? payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/receipts/${payment.id}`}
                        className="text-sm text-stone-600 underline underline-offset-2 hover:text-stone-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="mb-2 flex items-start justify-between">
                  <p className="font-medium text-stone-900">{formatCurrency(Number(payment.amount))}</p>
                  <span className={statusBadgeClass(payment.status)}>
                    {STATUS_LABELS[payment.status] ?? payment.status}
                  </span>
                </div>
                <p className="mb-1 text-sm text-stone-500">{formatDate(payment.created_at)}</p>
                <p className="mb-3 text-sm text-stone-500">{METHOD_LABELS[payment.method] ?? payment.method}</p>
                <Link
                  href={`/receipts/${payment.id}`}
                  className="text-sm font-medium text-stone-600 underline underline-offset-2 hover:text-stone-900"
                >
                  View receipt
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
