// RSC wrapper — resolves property_id and unit_id from the tenant's active lease server-side.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NewMaintenanceRequestForm from './NewMaintenanceRequestForm'

export default async function NewMaintenanceRequestPage() {
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

  const { data: lease } = await supabase
    .from('leases')
    .select('id, unit_id, units!unit_id(property_id)')
    .eq('tenant_id', person.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!lease) {
    return (
      <div className="cy-portal-page" style={{ maxWidth: 560 }}>
        <h1 className="cy-portal-title">Submit a maintenance request</h1>
        <div className="cy-portal-empty">
          <p className="cy-portal-empty-title">No active lease found</p>
          <p className="cy-portal-empty-sub">
            You need an active lease to submit a maintenance request. Contact your property manager.
          </p>
        </div>
      </div>
    )
  }

  const unit = Array.isArray(lease.units) ? lease.units[0] : lease.units
  const propertyId = unit?.property_id ?? null

  if (!propertyId) {
    return (
      <div className="cy-portal-page" style={{ maxWidth: 560 }}>
        <h1 className="cy-portal-title">Submit a maintenance request</h1>
        <div className="cy-portal-empty">
          <p className="cy-portal-empty-title">Unable to determine your property</p>
          <p className="cy-portal-empty-sub">
            Please contact your property manager for assistance.
          </p>
        </div>
      </div>
    )
  }

  return (
    <NewMaintenanceRequestForm propertyId={propertyId} unitId={lease.unit_id ?? null} />
  )
}
