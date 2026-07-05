// src/app/(tenant)/receipts/[paymentId]/page.tsx
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
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default async function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params
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

  // 3. Load payment with full join — RLS restricts to tenant's own payments
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

  // RLS will return null for cross-tenant access
  if (!payment) notFound()

  // Narrow nested join types
  const lease = Array.isArray(payment.leases) ? payment.leases[0] : payment.leases
  const unit = lease ? (Array.isArray(lease.units) ? lease.units[0] : lease.units) : null
  const property = unit ? (Array.isArray(unit.properties) ? unit.properties[0] : unit.properties) : null
  const tenant = lease ? (Array.isArray(lease.people) ? lease.people[0] : lease.people) : null

  const tenantName = tenant ? `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() : '—'
  const unitDisplay = unit?.unit_number ? `Unit ${unit.unit_number}` : null
  const propertyDisplay = property
    ? [property.street_address, unitDisplay, property.city, property.province].filter(Boolean).join(', ')
    : '—'

  const paymentRef = paymentId.slice(-8).toUpperCase()

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="mx-auto max-w-lg px-4 py-8 md:px-8">
        <div className="no-print mb-6 flex items-center justify-between">
          <Link
            href="/my-home/payments"
            className="text-sm text-stone-500 underline underline-offset-2 hover:text-stone-800"
          >
            ← Back to Payment History
          </Link>
          <PrintButton />
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <div className="mb-6 border-b border-stone-100 pb-4">
            <h1 className="text-xl font-semibold text-stone-900">Payment Receipt</h1>
            <p className="mt-1 text-sm text-stone-500">Canary Property Management</p>
          </div>

          <dl className="space-y-4">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 text-sm font-medium text-stone-500">Payment Reference</dt>
              <dd className="font-mono text-sm font-medium text-stone-900">{paymentRef}</dd>
            </div>

            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 text-sm font-medium text-stone-500">Date</dt>
              <dd className="text-sm text-stone-900">{formatDate(payment.created_at)}</dd>
            </div>

            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 text-sm font-medium text-stone-500">Tenant</dt>
              <dd className="text-sm text-stone-900">{tenantName}</dd>
            </div>

            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 text-sm font-medium text-stone-500">Property</dt>
              <dd className="text-sm text-stone-900">{propertyDisplay}</dd>
            </div>

            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 text-sm font-medium text-stone-500">Amount</dt>
              <dd className="text-sm font-semibold text-stone-900">{formatCurrency(Number(payment.amount))}</dd>
            </div>

            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 text-sm font-medium text-stone-500">Method</dt>
              <dd className="text-sm text-stone-900">{METHOD_LABELS[payment.method] ?? payment.method}</dd>
            </div>

            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 text-sm font-medium text-stone-500">Status</dt>
              <dd className="text-sm text-stone-900">{STATUS_LABELS[payment.status] ?? payment.status}</dd>
            </div>

            {payment.notes && (
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <dt className="w-40 shrink-0 text-sm font-medium text-stone-500">Notes</dt>
                <dd className="text-sm text-stone-600">{payment.notes}</dd>
              </div>
            )}
          </dl>

          <div className="mt-6 border-t border-stone-100 pt-4">
            <p className="text-xs text-stone-400">
              This is an official payment receipt. Keep this document for your records.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
