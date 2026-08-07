// Tenant payment history — all payments on active lease(s), with receipt links
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { CSSProperties } from 'react'
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

function statusChipStyle(status: string): CSSProperties {
  if (status === 'cleared') {
    return { background: 'color-mix(in srgb, var(--green) 14%, var(--panel))', color: 'var(--green)' }
  }
  if (status === 'pending_clearance') {
    return { background: 'color-mix(in srgb, var(--amber) 14%, var(--panel))', color: 'var(--amber)' }
  }
  if (status === 'failed') {
    return { background: 'color-mix(in srgb, var(--red) 14%, var(--panel))', color: 'var(--red)' }
  }
  return { background: 'var(--elev)', color: 'var(--dim)' }
}

export default async function PaymentHistoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: person } = await supabase
    .from('people')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  if (!person) redirect('/login')
  if (!person.role.includes('tenant')) redirect('/login')

  const { data: leases } = await supabase
    .from('leases')
    .select('id')
    .eq('tenant_id', person.id)
    .eq('status', 'active')

  const leaseIds = (leases ?? []).map((l) => l.id)

  const { data: payments } =
    leaseIds.length > 0
      ? await supabase
          .from('payments')
          .select('id, amount, method, status, created_at, notes')
          .in('lease_id', leaseIds)
          .order('created_at', { ascending: false })
      : { data: [] }

  return (
    <div className="cy-portal-page">
      <div className="cy-portal-page-head">
        <div>
          <h1 className="cy-portal-title">Payment history</h1>
          <p className="cy-portal-sub">All payments on your active lease.</p>
        </div>
        <Link href="/my-home" className="cy-portal-link">
          Back to My Home
        </Link>
      </div>

      {!payments || payments.length === 0 ? (
        <div className="cy-portal-empty">
          <p className="cy-portal-empty-title">No payment history yet.</p>
          <p className="cy-portal-empty-sub">
            Payments will appear here once recorded by your property manager.
          </p>
        </div>
      ) : (
        <>
          <div className="cy-portal-table-wrap hidden md:block">
            <table className="cy-portal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.created_at)}</td>
                    <td className="strong">{formatCurrency(Number(payment.amount))}</td>
                    <td>{METHOD_LABELS[payment.method] ?? payment.method}</td>
                    <td>
                      <span className="cy-status-chip" style={statusChipStyle(payment.status)}>
                        {STATUS_LABELS[payment.status] ?? payment.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/receipts/${payment.id}`} className="cy-portal-link">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cy-portal-stack md:hidden">
            {payments.map((payment) => (
              <div key={payment.id} className="cy-portal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--text)' }}>
                    {formatCurrency(Number(payment.amount))}
                  </p>
                  <span className="cy-status-chip" style={statusChipStyle(payment.status)}>
                    {STATUS_LABELS[payment.status] ?? payment.status}
                  </span>
                </div>
                <p className="cy-portal-muted" style={{ margin: '0 0 4px' }}>
                  {formatDate(payment.created_at)}
                </p>
                <p className="cy-portal-muted" style={{ margin: '0 0 12px' }}>
                  {METHOD_LABELS[payment.method] ?? payment.method}
                </p>
                <Link href={`/receipts/${payment.id}`} className="cy-portal-link">
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
