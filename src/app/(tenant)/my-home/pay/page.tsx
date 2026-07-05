/**
 * /my-home/pay — Tenant rent payment page
 *
 * Server Component. Loads the tenant's active lease server-side,
 * then renders the RentPaymentForm with lease data.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RentPaymentForm } from '@/components/payments/RentPaymentForm'

export default async function PayRentPage() {
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

  // 3. Fetch active lease with unit + property address
  const { data: lease } = await supabase
    .from('leases')
    .select(`
      id,
      monthly_rent,
      units!unit_id(
        unit_number,
        properties!property_id( street_address, city, province )
      )
    `)
    .eq('tenant_id', person.id)
    .eq('status', 'active')
    .maybeSingle()

  // Narrow nested join types
  const unit = lease
    ? (Array.isArray(lease.units) ? lease.units[0] : lease.units)
    : null
  const property = unit
    ? (Array.isArray(unit.properties) ? unit.properties[0] : unit.properties)
    : null

  const propertyAddress = property
    ? `${property.street_address}${unit ? ` — Unit ${unit.unit_number}` : ''}, ${property.city}, ${property.province}`
    : 'Your unit'

  return (
    <div className="mx-auto max-w-lg px-4 py-8 md:px-8">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/my-home"
          className="text-sm text-stone-500 underline-offset-2 hover:underline"
        >
          ← Back to My Home
        </Link>
      </div>

      <h1 className="mb-8 text-xl font-semibold text-stone-900">Pay Rent</h1>

      {!lease ? (
        <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center">
          <p className="text-base font-medium text-stone-700">No active lease found</p>
          <p className="mt-1 text-sm text-stone-500">
            Contact your property manager for assistance.
          </p>
          <Link
            href="/my-home"
            className="mt-4 inline-block text-sm text-stone-500 underline-offset-2 hover:underline"
          >
            Back to My Home
          </Link>
        </div>
      ) : (
        <RentPaymentForm
          leaseId={lease.id}
          monthlyRent={lease.monthly_rent}
          propertyAddress={propertyAddress}
        />
      )}
    </div>
  )
}
