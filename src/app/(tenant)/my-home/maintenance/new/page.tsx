// src/app/(tenant)/my-home/maintenance/new/page.tsx
// RSC wrapper — resolves property_id and unit_id from the tenant's active lease server-side,
// then renders the client NewMaintenanceRequestForm. This prevents tenants from supplying a
// different property_id via form manipulation (T-05-21).
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NewMaintenanceRequestForm from './NewMaintenanceRequestForm'

export default async function NewMaintenanceRequestPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: person } = await supabase
    .from('people')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  if (!person) redirect('/login')
  if (!person.role.includes('tenant')) redirect('/login')

  // Resolve active lease to get property_id and unit_id
  const { data: lease } = await supabase
    .from('leases')
    .select('id, unit_id, units!unit_id(property_id)')
    .eq('tenant_id', person.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!lease) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 md:px-8">
        <h1 className="mb-4 text-xl font-semibold text-stone-900">Submit a Maintenance Request</h1>
        <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center">
          <p className="text-base font-medium text-stone-700">No active lease found</p>
          <p className="mt-1 text-sm text-stone-500">
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
      <div className="mx-auto max-w-lg px-4 py-8 md:px-8">
        <h1 className="mb-4 text-xl font-semibold text-stone-900">Submit a Maintenance Request</h1>
        <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center">
          <p className="text-base font-medium text-stone-700">Unable to determine your property</p>
          <p className="mt-1 text-sm text-stone-500">
            Please contact your property manager for assistance.
          </p>
        </div>
      </div>
    )
  }

  return (
    <NewMaintenanceRequestForm
      propertyId={propertyId}
      unitId={lease.unit_id ?? null}
    />
  )
}
