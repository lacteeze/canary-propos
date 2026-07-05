// src/app/(manager)/leases/page.tsx
// Leases list page — shows all org leases with expiry alert callout (LEASE-01, LEASE-02)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AddLeaseForm } from '@/components/leases/AddLeaseForm'
import { ExpiryAlertCallout, type ExpiringLease } from '@/components/leases/ExpiryAlertCallout'

function computeDisplayStatus(endDate: string, dbStatus: string): 'Active' | 'Expiring' | 'Expired' {
  const today = new Date().toISOString().split('T')[0]
  if (dbStatus === 'expired' || endDate < today) return 'Expired'
  const daysLeft = Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / 86400000)
  if (daysLeft <= 90) return 'Expiring'
  return 'Active'
}

function statusBadgeClass(status: 'Active' | 'Expiring' | 'Expired'): string {
  if (status === 'Active') return 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700'
  if (status === 'Expiring') return 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700'
  return 'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600'
}

function renewalBadgeClass(renewalStatus: string | null): string {
  if (!renewalStatus) return ''
  if (renewalStatus === 'pending') return 'inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700'
  if (renewalStatus === 'sent') return 'inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700'
  if (renewalStatus === 'accepted') return 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700'
  if (renewalStatus === 'declined') return 'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700'
  return ''
}

export default async function LeasesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: callerPerson } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) redirect('/login')

  const isManager = callerPerson.role.includes('manager') || callerPerson.role.includes('admin')

  // Fetch all leases with full join
  const { data: leases } = await supabase
    .from('leases')
    .select(`
      id, start_date, end_date, monthly_rent, status, renewal_status,
      people!tenant_id(first_name, last_name),
      units!unit_id(unit_number, properties!property_id(street_address, city))
    `)
    .eq('org_id', callerPerson.org_id)
    .order('end_date', { ascending: true })

  // Fetch tenants and properties for AddLeaseForm
  const [{ data: tenants }, { data: properties }] = await Promise.all([
    supabase
      .from('people')
      .select('id, first_name, last_name, role')
      .eq('org_id', callerPerson.org_id)
      .eq('active', true),
    supabase
      .from('properties')
      .select('id, street_address, city')
      .eq('org_id', callerPerson.org_id)
      .order('street_address', { ascending: true }),
  ])

  // Filter tenants (role is text[])
  const tenantList = (tenants ?? []).filter((p) => p.role.includes('tenant'))

  // Derive expiring leases (within 90 days, active status) for callout
  const today = new Date().toISOString().split('T')[0]
  const ninetyDaysFromNow = new Date()
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)
  const ninetyStr = ninetyDaysFromNow.toISOString().split('T')[0]

  const expiringLeases: ExpiringLease[] = (leases ?? [])
    .filter((l) => l.status === 'active' && l.end_date >= today && l.end_date <= ninetyStr)
    .map((l) => {
      const tenant = l.people as { first_name: string | null; last_name: string | null } | null
      const unit = l.units as { unit_number: string | null; properties: { street_address: string; city: string } | null } | null
      const tenantName = tenant
        ? [tenant.first_name, tenant.last_name].filter(Boolean).join(' ') || 'Unknown Tenant'
        : 'Unknown Tenant'
      const unitDisplay = unit
        ? `${unit.properties?.street_address ?? ''} Unit ${unit.unit_number ?? '—'}`
        : '—'
      const daysUntilExpiry = Math.ceil(
        (new Date(l.end_date).getTime() - new Date().getTime()) / 86400000
      )
      return { id: l.id, tenantName, propertyUnit: unitDisplay, endDate: l.end_date, daysUntilExpiry }
    })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Leases</h1>
          <p className="mt-1 text-sm text-stone-500">
            Manage all active and upcoming leases.
          </p>
        </div>
        {isManager && (
          <AddLeaseForm
            tenants={tenantList}
            properties={properties ?? []}
          />
        )}
      </div>

      {/* Expiry alert callout */}
      <ExpiryAlertCallout leases={expiringLeases} />

      {/* Lease list */}
      {(!leases || leases.length === 0) ? (
        <div className="rounded-xl border border-dashed border-stone-200 px-8 py-16 text-center">
          <h2 className="mb-2 text-base font-semibold text-stone-900">No leases yet</h2>
          <p className="mb-6 text-sm text-stone-500">
            Create a lease to link a tenant to a unit.
          </p>
          {isManager && (
            <AddLeaseForm
              tenants={tenantList}
              properties={properties ?? []}
              buttonLabel="Create your first lease"
            />
          )}
        </div>
      ) : (
        <>
          {/* Desktop table (md+) */}
          <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Property + Unit</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Monthly Rent</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Renewal</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {leases.map((lease) => {
                  const tenant = lease.people as { first_name: string | null; last_name: string | null } | null
                  const unit = lease.units as { unit_number: string | null; properties: { street_address: string; city: string } | null } | null
                  const tenantName = tenant
                    ? [tenant.first_name, tenant.last_name].filter(Boolean).join(' ') || '—'
                    : '—'
                  const propertyUnit = unit
                    ? `${unit.properties?.street_address ?? ''}, ${unit.properties?.city ?? ''} · Unit ${unit.unit_number ?? '—'}`
                    : '—'
                  const displayStatus = computeDisplayStatus(lease.end_date, lease.status)
                  return (
                    <tr key={lease.id} className="bg-white hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-900">{tenantName}</td>
                      <td className="px-4 py-3 text-stone-600">{propertyUnit}</td>
                      <td className="px-4 py-3 text-stone-600">{lease.start_date}</td>
                      <td className="px-4 py-3 text-stone-600">{lease.end_date}</td>
                      <td className="px-4 py-3 text-stone-600">
                        ${lease.monthly_rent.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadgeClass(displayStatus)}>{displayStatus}</span>
                      </td>
                      <td className="px-4 py-3">
                        {lease.renewal_status ? (
                          <span className={renewalBadgeClass(lease.renewal_status)}>
                            {lease.renewal_status.charAt(0).toUpperCase() + lease.renewal_status.slice(1)}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/leases/${lease.id}`}
                          className="text-sm text-stone-600 underline underline-offset-2 hover:text-stone-900"
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
            {leases.map((lease) => {
              const tenant = lease.people as { first_name: string | null; last_name: string | null } | null
              const unit = lease.units as { unit_number: string | null; properties: { street_address: string; city: string } | null } | null
              const tenantName = tenant
                ? [tenant.first_name, tenant.last_name].filter(Boolean).join(' ') || '—'
                : '—'
              const propertyUnit = unit
                ? `${unit.properties?.street_address ?? ''} · Unit ${unit.unit_number ?? '—'}`
                : '—'
              const displayStatus = computeDisplayStatus(lease.end_date, lease.status)
              return (
                <div key={lease.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <p className="font-medium text-stone-900">{tenantName}</p>
                    <span className={statusBadgeClass(displayStatus)}>{displayStatus}</span>
                  </div>
                  <p className="mb-1 text-sm text-stone-500">{propertyUnit}</p>
                  <p className="mb-1 text-xs text-stone-400">
                    {lease.start_date} → {lease.end_date}
                  </p>
                  <p className="mb-3 text-sm font-medium text-stone-700">
                    ${lease.monthly_rent.toLocaleString('en-CA', { minimumFractionDigits: 2 })}/mo
                  </p>
                  <Link
                    href={`/leases/${lease.id}`}
                    className="text-sm font-medium text-stone-600 underline underline-offset-2 hover:text-stone-900"
                  >
                    View lease
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
