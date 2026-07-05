// src/app/(manager)/properties/page.tsx
// Properties list RSC page — shows all buildings for the org (PROP-01, PROP-02)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AddPropertyForm } from '@/components/properties/AddPropertyForm'

export default async function PropertiesPage() {
  const supabase = await createClient()

  // Verify session
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get caller's person row to resolve org_id and role
  const { data: callerPerson } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) redirect('/login')

  const isManager =
    callerPerson.role?.includes('manager') || callerPerson.role?.includes('admin')

  // Fetch properties with joined owner name and portfolio name
  const { data: properties } = await supabase
    .from('properties')
    .select(
      `id, street_address, city, province, property_type, photo_paths,
       people!owner_id(id, first_name, last_name),
       portfolios!portfolio_id(id, name)`
    )
    .eq('org_id', callerPerson.org_id)
    .order('street_address', { ascending: true })

  // Fetch all units for the org to compute per-property counts
  const { data: allUnits } = await supabase
    .from('units')
    .select('id, property_id, status')
    .eq('org_id', callerPerson.org_id)

  // Fetch org for province pre-population in AddPropertyForm
  const { data: org } = await supabase
    .from('organizations')
    .select('province')
    .eq('id', callerPerson.org_id)
    .single()

  // Fetch owner contacts (people with 'owner' role)
  const { data: owners } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .eq('org_id', callerPerson.org_id)
    .eq('active', true)
    .contains('role', ['owner'])
    .order('last_name', { ascending: true })

  // Fetch portfolios
  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id, name')
    .eq('org_id', callerPerson.org_id)
    .order('name', { ascending: true })

  // Compute unit counts by property
  const unitsByProperty = (allUnits ?? []).reduce<
    Record<string, { total: number; occupied: number }>
  >((acc, unit) => {
    const pid = unit.property_id ?? ''
    if (!acc[pid]) acc[pid] = { total: 0, occupied: 0 }
    acc[pid].total++
    if (unit.status === 'occupied') acc[pid].occupied++
    return acc
  }, {})

  const orgProvince = org?.province ?? 'ON'
  const propertiesList = properties ?? []
  const ownersList = owners ?? []
  const portfoliosList = portfolios ?? []

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Properties</h1>
          <p className="mt-1 text-sm text-stone-500">
            {propertiesList.length === 0
              ? 'No properties added yet.'
              : `${(allUnits ?? []).length} total unit${(allUnits ?? []).length === 1 ? '' : 's'} across ${propertiesList.length} building${propertiesList.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {isManager && (
          <AddPropertyForm
            orgProvince={orgProvince}
            owners={ownersList}
            portfolios={portfoliosList}
          />
        )}
      </div>

      {/* Empty state */}
      {propertiesList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 px-8 py-16 text-center">
          <h2 className="mb-2 text-base font-semibold text-stone-900">No properties yet</h2>
          <p className="mb-6 text-sm text-stone-500">
            Add your first building to start managing units and leases.
          </p>
          {isManager && (
            <AddPropertyForm
              orgProvince={orgProvince}
              owners={ownersList}
              portfolios={portfoliosList}
              buttonLabel="Add your first property"
            />
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Portfolio</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Units</th>
                  <th className="px-4 py-3">Occupancy</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {propertiesList.map((property) => {
                  const counts = unitsByProperty[property.id] ?? { total: 0, occupied: 0 }
                  // Supabase join returns object or null
                  const ownerData = property.people as { first_name: string | null; last_name: string | null } | null
                  const portfolioData = property.portfolios as { name: string } | null
                  const ownerName = ownerData
                    ? [ownerData.first_name, ownerData.last_name].filter(Boolean).join(' ')
                    : null

                  return (
                    <tr key={property.id} className="bg-white hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-900">
                        <div>{property.street_address}</div>
                        <div className="text-xs text-stone-400">{property.city}, {property.province}</div>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {portfolioData?.name ?? <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {ownerName || <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-stone-600">{counts.total}</td>
                      <td className="px-4 py-3 text-stone-600">
                        {counts.total > 0
                          ? `${counts.occupied}/${counts.total} occupied`
                          : <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/properties/${property.id}`}
                          className="text-sm text-amber-600 hover:text-amber-700"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {propertiesList.map((property) => {
              const counts = unitsByProperty[property.id] ?? { total: 0, occupied: 0 }
              const ownerData = property.people as { first_name: string | null; last_name: string | null } | null
              const portfolioData = property.portfolios as { name: string } | null
              const ownerName = ownerData
                ? [ownerData.first_name, ownerData.last_name].filter(Boolean).join(' ')
                : null

              return (
                <div key={property.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="mb-2">
                    <p className="font-medium text-stone-900">{property.street_address}</p>
                    <p className="text-sm text-stone-400">{property.city}, {property.province}</p>
                  </div>
                  <div className="mb-3 space-y-1 text-sm text-stone-500">
                    {ownerName && <p>Owner: {ownerName}</p>}
                    {portfolioData && <p>Portfolio: {portfolioData.name}</p>}
                    <p>
                      {counts.total} unit{counts.total === 1 ? '' : 's'}
                      {counts.total > 0 ? ` · ${counts.occupied}/${counts.total} occupied` : ''}
                    </p>
                  </div>
                  <Link
                    href={`/properties/${property.id}`}
                    className="text-sm font-medium text-amber-600 hover:text-amber-700"
                  >
                    View property →
                  </Link>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
