/**
 * /my-home/pay — Tenant rent payment page
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RentPaymentForm } from '@/components/payments/RentPaymentForm'

export default async function PayRentPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: person } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .single()
  if (!person) redirect('/login')

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

  const unit = lease ? (Array.isArray(lease.units) ? lease.units[0] : lease.units) : null
  const property = unit
    ? Array.isArray(unit.properties)
      ? unit.properties[0]
      : unit.properties
    : null

  const propertyAddress = property
    ? `${property.street_address}${unit ? ` — Unit ${unit.unit_number}` : ''}, ${property.city}, ${property.province}`
    : 'Your unit'

  return (
    <div className="cy-portal-page" style={{ maxWidth: 560 }}>
      <div className="cy-portal-page-head">
        <div>
          <Link href="/my-home" className="cy-portal-link">
            ← Back to My Home
          </Link>
          <h1 className="cy-portal-title" style={{ marginTop: 10 }}>
            Pay rent
          </h1>
        </div>
      </div>

      {!lease ? (
        <div className="cy-portal-empty">
          <p className="cy-portal-empty-title">No active lease found</p>
          <p className="cy-portal-empty-sub">
            Contact your property manager for assistance.
          </p>
          <p style={{ marginTop: 14 }}>
            <Link href="/my-home" className="cy-portal-link">
              Back to My Home
            </Link>
          </p>
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
