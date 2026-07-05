import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LeaseDownloadButton from './LeaseDownloadButton'

// --- Formatting helpers ---
function formatDate(dateStr: string): string {
  // Parse YYYY-MM-DD as local date to avoid UTC-offset day shift
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2)
}

export default async function MyHomePage() {
  const supabase = await createClient()

  // 1. Session guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Resolve person row
  const { data: person } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .single()
  if (!person) redirect('/login')

  // 3. Fetch active lease (maybeSingle — tenant may have no lease yet)
  const { data: lease } = await supabase
    .from('leases')
    .select(`
      id,
      start_date,
      end_date,
      monthly_rent,
      document_path,
      units!unit_id(
        unit_number,
        properties!property_id( street_address, city, province )
      )
    `)
    .eq('tenant_id', person.id)
    .eq('status', 'active')
    .maybeSingle()

  // Narrow nested join types (Supabase returns arrays for joined tables)
  const unit = lease
    ? (Array.isArray(lease.units) ? lease.units[0] : lease.units)
    : null
  const property = unit
    ? (Array.isArray(unit.properties) ? unit.properties[0] : unit.properties)
    : null

  return (
    <div className="mx-auto max-w-lg px-4 py-8 md:px-8">
      <h1 className="mb-8 text-xl font-semibold text-stone-900">My Home</h1>

      {!lease ? (
        // Empty state
        <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center">
          <p className="text-base font-medium text-stone-700">No active lease found</p>
          <p className="mt-1 text-sm text-stone-500">
            Contact your property manager for assistance.
          </p>
        </div>
      ) : (
        // Lease card
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-stone-900">Your Current Lease</h2>

          <dl className="space-y-3">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-32 shrink-0 text-sm font-medium text-stone-500">Property</dt>
              <dd className="text-sm text-stone-900">
                {property
                  ? `${property.street_address}${unit ? ` — Unit ${unit.unit_number}` : ''}, ${property.city}, ${property.province}`
                  : '—'}
              </dd>
            </div>

            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-32 shrink-0 text-sm font-medium text-stone-500">Tenant</dt>
              <dd className="text-sm text-stone-900">
                {person.first_name} {person.last_name}
              </dd>
            </div>

            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-32 shrink-0 text-sm font-medium text-stone-500">Term</dt>
              <dd className="text-sm text-stone-900">
                {lease.start_date && lease.end_date
                  ? `${formatDate(lease.start_date)} – ${formatDate(lease.end_date)}`
                  : '—'}
              </dd>
            </div>

            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-32 shrink-0 text-sm font-medium text-stone-500">Monthly Rent</dt>
              <dd className="text-sm text-stone-900">
                {lease.monthly_rent != null ? formatCurrency(Number(lease.monthly_rent)) : '—'}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <LeaseDownloadButton
              leaseId={lease.id}
              hasDocument={!!lease.document_path}
            />
            <Link
              href="/my-home/pay"
              className="inline-flex items-center justify-center rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700"
            >
              Pay Rent
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
