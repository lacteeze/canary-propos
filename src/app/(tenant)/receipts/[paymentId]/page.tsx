// Individual payment receipt — RLS restricts to tenant's own payments
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PrintButton from './PrintButton'

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
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>
}) {
  const { paymentId } = await params
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

  const { data: payment } = await supabase
    .from('payments')
    .select(`
      id,
      amount,
      method,
      status,
      created_at,
      notes,
      leases!lease_id(
        monthly_rent,
        tenant_id,
        units!unit_id(
          unit_number,
          properties!property_id( street_address, city, province )
        ),
        people!tenant_id( first_name, last_name )
      )
    `)
    .eq('id', paymentId)
    .maybeSingle()

  if (!payment) notFound()

  const lease = Array.isArray(payment.leases) ? payment.leases[0] : payment.leases
  const unit = lease ? (Array.isArray(lease.units) ? lease.units[0] : lease.units) : null
  const property = unit
    ? Array.isArray(unit.properties)
      ? unit.properties[0]
      : unit.properties
    : null
  const tenant = lease ? (Array.isArray(lease.people) ? lease.people[0] : lease.people) : null

  const tenantName = tenant ? `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() : '—'
  const unitDisplay = unit?.unit_number ? `Unit ${unit.unit_number}` : null
  const propertyDisplay = property
    ? [property.street_address, unitDisplay, property.city, property.province]
        .filter(Boolean)
        .join(', ')
    : '—'

  const paymentRef = paymentId.slice(-8).toUpperCase()

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="cy-portal-page" style={{ maxWidth: 560 }}>
        <div className="no-print cy-portal-page-head">
          <Link href="/my-home/payments" className="cy-portal-link">
            ← Back to payment history
          </Link>
          <PrintButton />
        </div>

        <div className="cy-portal-card">
          <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
            <h1 className="cy-portal-title" style={{ fontSize: 20 }}>
              Payment receipt
            </h1>
            <p className="cy-portal-sub">Canary Property Management</p>
          </div>

          <dl className="cy-portal-dl">
            <div>
              <dt>Payment reference</dt>
              <dd style={{ fontFamily: 'var(--font-plex-mono), monospace', fontWeight: 600 }}>
                {paymentRef}
              </dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(payment.created_at)}</dd>
            </div>
            <div>
              <dt>Tenant</dt>
              <dd>{tenantName}</dd>
            </div>
            <div>
              <dt>Property</dt>
              <dd>{propertyDisplay}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd style={{ fontWeight: 700 }}>{formatCurrency(Number(payment.amount))}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{METHOD_LABELS[payment.method] ?? payment.method}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{STATUS_LABELS[payment.status] ?? payment.status}</dd>
            </div>
            {payment.notes && (
              <div>
                <dt>Notes</dt>
                <dd style={{ color: 'var(--dim)' }}>{payment.notes}</dd>
              </div>
            )}
          </dl>

          <p className="cy-portal-muted" style={{ margin: '18px 0 0', fontSize: 12 }}>
            This is an official payment receipt. Keep this document for your records.
          </p>
        </div>
      </div>
    </>
  )
}
