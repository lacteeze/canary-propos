// src/app/(manager)/properties/[id]/page.tsx
// Property detail RSC page — Building Info, Units, Leases tabs (PROP-03, PROP-04, PROP-05, PROP-06)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AddUnitForm } from '@/components/properties/AddUnitForm'
import { PropertyPhotoUpload } from '@/components/properties/PropertyPhotoUpload'
import { ExpiryAlertCallout } from '@/components/leases/ExpiryAlertCallout'
import { ListingForm } from '@/components/listings/ListingForm'
import { toggleListingStatus } from '@/app/actions/listings'
import { AnnouncementsSection } from './AnnouncementsSection'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  house: 'House',
  duplex: 'Duplex',
  apartment_building: 'Apartment Building',
  condo: 'Condo',
  townhouse: 'Townhouse',
  other: 'Other',
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  vacant: { bg: 'bg-green-100', text: 'text-green-700', label: 'Vacant' },
  occupied: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Occupied' },
  maintenance: { bg: 'bg-red-100', text: 'text-red-700', label: 'Maintenance' },
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { id: propertyId } = await params

  const supabase = await createClient()

  // Verify session
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get caller's person row
  const { data: callerPerson } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) redirect('/login')

  const isManager =
    callerPerson.role?.includes('manager') || callerPerson.role?.includes('admin')

  // Fetch property with owner and portfolio joins (org-scoped)
  const { data: property } = await supabase
    .from('properties')
    .select(
      `id, street_address, city, province, postal_code, property_type, photo_paths,
       people!owner_id(id, first_name, last_name),
       portfolios!portfolio_id(id, name)`
    )
    .eq('id', propertyId)
    .eq('org_id', callerPerson.org_id)
    .single()

  // Redirect if property not found or wrong org
  if (!property) redirect('/properties')

  // Fetch units for this property
  const { data: units } = await supabase
    .from('units')
    .select('id, unit_number, floor, bedrooms, bathrooms, sq_footage, asking_rent, amenities, status')
    .eq('property_id', propertyId)
    .order('unit_number', { ascending: true })

  const unitsList = units ?? []
  const unitIds = unitsList.map((u) => u.id)

  // Fetch active leases for units in this property
  const { data: leases } = unitIds.length > 0
    ? await supabase
        .from('leases')
        .select(
          `id, start_date, end_date, monthly_rent, status, unit_id,
           people!tenant_id(id, first_name, last_name)`
        )
        .in('unit_id', unitIds)
        .eq('org_id', callerPerson.org_id)
        .order('end_date', { ascending: true })
    : { data: [] }

  const leasesList = leases ?? []

  // Fetch listings for units in this property
  const { data: listings } = unitIds.length > 0
    ? await supabase
        .from('listings')
        .select('id, unit_id, listing_title, listing_description, highlights, display_rent, available_from, status')
        .in('unit_id', unitIds)
        .eq('org_id', callerPerson.org_id)
    : { data: [] }

  const listingsList = listings ?? []

  // Fetch announcements for this property (newest first)
  const { data: announcementsData } = await supabase
    .from('announcements')
    .select('id, title, body, created_at, expires_at')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(50)

  const announcementsList = announcementsData ?? []

  // Compute occupancy
  const occupiedCount = unitsList.filter((u) => u.status === 'occupied').length
  const totalCount = unitsList.length

  // Compute expiring leases (within 90 days)
  const today = new Date()
  const expiringLeases = leasesList
    .filter((lease) => {
      if (!lease.end_date) return false
      const endDate = new Date(lease.end_date)
      const daysUntil = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return daysUntil >= 0 && daysUntil <= 90
    })
    .map((lease) => {
      const tenantData = lease.people as { first_name: string | null; last_name: string | null } | null
      const tenantName = tenantData
        ? [tenantData.first_name, tenantData.last_name].filter(Boolean).join(' ')
        : 'Unknown tenant'
      const unit = unitsList.find((u) => u.id === lease.unit_id)
      const endDate = new Date(lease.end_date)
      const daysUntilExpiry = Math.ceil(
        (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        id: lease.id,
        tenantName,
        propertyUnit: unit?.unit_number ?? '—',
        endDate: lease.end_date,
        daysUntilExpiry,
      }
    })

  // Typed join data
  const ownerData = property.people as { id: string; first_name: string | null; last_name: string | null } | null
  const portfolioData = property.portfolios as { id: string; name: string } | null
  const ownerName = ownerData
    ? [ownerData.first_name, ownerData.last_name].filter(Boolean).join(' ')
    : null

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      {/* Back link */}
      <div className="mb-4">
        <Link href="/properties" className="text-sm text-stone-500 hover:text-stone-700">
          ← Properties
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">{property.street_address}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {property.city}, {property.province}
            {ownerName && ` · Owner: ${ownerName}`}
            {portfolioData && ` · ${portfolioData.name}`}
            {totalCount > 0 && ` · ${occupiedCount}/${totalCount} occupied`}
            {totalCount === 0 && ' · No units yet'}
          </p>
        </div>
        {isManager && (
          <AddUnitForm propertyId={propertyId} />
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="building-info">
        <TabsList>
          <TabsTrigger value="building-info">Building Info</TabsTrigger>
          <TabsTrigger value="units">Units {totalCount > 0 && `(${totalCount})`}</TabsTrigger>
          <TabsTrigger value="leases">Leases {leasesList.length > 0 && `(${leasesList.length})`}</TabsTrigger>
          <TabsTrigger value="listings">Listings {listingsList.length > 0 && `(${listingsList.length})`}</TabsTrigger>
          <TabsTrigger value="announcements">Announcements {announcementsList.length > 0 && `(${announcementsList.length})`}</TabsTrigger>
        </TabsList>

        {/* Building Info Tab */}
        <TabsContent value="building-info">
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">Address</dt>
                <dd className="mt-1 text-sm text-stone-900">
                  {property.street_address}<br />
                  {property.city}, {property.province}
                  {property.postal_code && ` ${property.postal_code}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">Type</dt>
                <dd className="mt-1 text-sm text-stone-900">
                  {PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">Owner</dt>
                <dd className="mt-1 text-sm text-stone-900">
                  {ownerName ?? <span className="text-stone-400">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">Portfolio</dt>
                <dd className="mt-1 text-sm text-stone-900">
                  {portfolioData?.name ?? <span className="text-stone-400">—</span>}
                </dd>
              </div>
            </dl>

            {/* Photo section */}
            <div className="mt-6 border-t border-stone-100 pt-6">
              <h3 className="mb-3 text-sm font-medium text-stone-700">Photos</h3>
              {isManager ? (
                <PropertyPhotoUpload
                  propertyId={property.id}
                  orgId={callerPerson.org_id}
                  existingPaths={property.photo_paths ?? []}
                />
              ) : (
                <p className="text-sm text-stone-400">No photos uploaded yet.</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Units Tab */}
        <TabsContent value="units">
          {unitsList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 px-8 py-12 text-center">
              <h2 className="mb-2 text-base font-semibold text-stone-900">No units yet</h2>
              <p className="mb-6 text-sm text-stone-500">
                Add the first unit to this property.
              </p>
              {isManager && <AddUnitForm propertyId={propertyId} buttonLabel="Add first unit" />}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                    <tr>
                      <th className="px-4 py-3">Unit #</th>
                      <th className="px-4 py-3">Beds / Baths</th>
                      <th className="px-4 py-3">Sq Ft</th>
                      <th className="px-4 py-3">Asking Rent</th>
                      <th className="px-4 py-3">Status</th>
                      {isManager && <th className="px-4 py-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {unitsList.map((unit) => {
                      const badge = STATUS_BADGE[unit.status] ?? STATUS_BADGE.vacant
                      return (
                        <tr key={unit.id} className="bg-white hover:bg-stone-50">
                          <td className="px-4 py-3 font-medium text-stone-900">
                            {unit.unit_number ?? '—'}
                            {unit.floor != null && (
                              <span className="ml-1 text-xs text-stone-400">Floor {unit.floor}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-stone-600">
                            {unit.bedrooms} bd / {unit.bathrooms} ba
                          </td>
                          <td className="px-4 py-3 text-stone-600">
                            {unit.sq_footage != null ? `${unit.sq_footage} sq ft` : <span className="text-stone-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-stone-600">
                            {unit.asking_rent != null
                              ? new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(unit.asking_rent)
                              : <span className="text-stone-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          {isManager && (
                            <td className="px-4 py-3">
                              {/* Edit unit — AddUnitForm pre-populated would go here in a future iteration */}
                              <span className="text-xs text-stone-400">Edit</span>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {unitsList.map((unit) => {
                  const badge = STATUS_BADGE[unit.status] ?? STATUS_BADGE.vacant
                  return (
                    <div key={unit.id} className="rounded-xl border border-stone-200 bg-white p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <p className="font-medium text-stone-900">
                            Unit {unit.unit_number ?? '—'}
                          </p>
                          <p className="text-sm text-stone-500">
                            {unit.bedrooms} bd / {unit.bathrooms} ba
                            {unit.sq_footage != null && ` · ${unit.sq_footage} sq ft`}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      {unit.asking_rent != null && (
                        <p className="text-sm text-stone-500">
                          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(unit.asking_rent)}/mo
                        </p>
                      )}
                      {unit.amenities && unit.amenities.length > 0 && (
                        <p className="mt-1 text-xs text-stone-400">{unit.amenities.join(', ')}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* Leases Tab */}
        <TabsContent value="leases">
          {expiringLeases.length > 0 && (
            <ExpiryAlertCallout leases={expiringLeases} />
          )}

          {leasesList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 px-8 py-12 text-center">
              <h2 className="mb-2 text-base font-semibold text-stone-900">No leases yet</h2>
              <p className="text-sm text-stone-500">
                Leases for units in this property will appear here.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                    <tr>
                      <th className="px-4 py-3">Tenant</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Monthly Rent</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {leasesList.map((lease) => {
                      const tenantData = lease.people as { first_name: string | null; last_name: string | null } | null
                      const tenantName = tenantData
                        ? [tenantData.first_name, tenantData.last_name].filter(Boolean).join(' ')
                        : '—'
                      const unit = unitsList.find((u) => u.id === lease.unit_id)
                      return (
                        <tr key={lease.id} className="bg-white hover:bg-stone-50">
                          <td className="px-4 py-3 font-medium text-stone-900">{tenantName}</td>
                          <td className="px-4 py-3 text-stone-600">{unit?.unit_number ?? '—'}</td>
                          <td className="px-4 py-3 text-stone-600">
                            {lease.start_date} – {lease.end_date}
                          </td>
                          <td className="px-4 py-3 text-stone-600">
                            {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(lease.monthly_rent)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700 capitalize">
                              {lease.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={`/leases/${lease.id}`}
                              className="text-sm text-amber-600 hover:text-amber-700"
                            >
                              View
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {leasesList.map((lease) => {
                  const tenantData = lease.people as { first_name: string | null; last_name: string | null } | null
                  const tenantName = tenantData
                    ? [tenantData.first_name, tenantData.last_name].filter(Boolean).join(' ')
                    : 'Unknown tenant'
                  const unit = unitsList.find((u) => u.id === lease.unit_id)
                  return (
                    <div key={lease.id} className="rounded-xl border border-stone-200 bg-white p-4">
                      <div className="mb-1 flex items-start justify-between">
                        <p className="font-medium text-stone-900">{tenantName}</p>
                        <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700 capitalize">
                          {lease.status}
                        </span>
                      </div>
                      <p className="text-sm text-stone-500">Unit {unit?.unit_number ?? '—'}</p>
                      <p className="text-sm text-stone-500">{lease.start_date} – {lease.end_date}</p>
                      <p className="text-sm text-stone-500">
                        {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(lease.monthly_rent)}/mo
                      </p>
                      <a
                        href={`/leases/${lease.id}`}
                        className="mt-2 block text-sm font-medium text-amber-600 hover:text-amber-700"
                      >
                        View lease →
                      </a>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* Listings Tab */}
        <TabsContent value="listings">
          {listingsList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 px-8 py-12 text-center">
              <h2 className="mb-2 text-base font-semibold text-stone-900">No listing yet</h2>
              <p className="mb-6 text-sm text-stone-500">
                Create a listing for a unit in this property to attract tenants.
              </p>
              {isManager && unitsList.length > 0 && (
                <ListingForm
                  propertyId={propertyId}
                  orgId={callerPerson.org_id}
                  units={unitsList}
                />
              )}
              {isManager && unitsList.length === 0 && (
                <p className="text-sm text-stone-400">Add units to this property before creating a listing.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {listingsList.map((listing) => {
                const unit = unitsList.find((u) => u.id === listing.unit_id)
                const statusBadge = {
                  draft: { bg: 'bg-stone-100', text: 'text-stone-700', label: 'Draft' },
                  published: { bg: 'bg-green-100', text: 'text-green-700', label: 'Published' },
                  unlisted: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Unlisted' },
                }[listing.status as string] ?? { bg: 'bg-stone-100', text: 'text-stone-700', label: listing.status }

                const nextStatus = listing.status === 'published' ? 'unlisted' : 'published'
                const toggleLabel = listing.status === 'published' ? 'Unpublish' : 'Publish'

                return (
                  <div key={listing.id} className="rounded-xl border border-stone-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-stone-900">{listing.listing_title}</h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-stone-500">
                          Unit {unit?.unit_number ?? '—'}
                          {listing.display_rent != null
                            ? ` · ${new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(listing.display_rent)}/mo`
                            : ' · Rent not set'}
                          {listing.available_from ? ` · Available ${listing.available_from}` : ''}
                        </p>
                        {listing.listing_description && (
                          <p className="mt-2 text-sm text-stone-600 line-clamp-2">{listing.listing_description}</p>
                        )}
                        {listing.highlights && listing.highlights.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {listing.highlights.map((h, i) => (
                              <span key={i} className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600">
                                {h}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {isManager && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <form
                            action={async (_fd: FormData) => { await toggleListingStatus(listing.id, nextStatus as 'draft' | 'published' | 'unlisted', propertyId) }}
                          >
                            <button
                              type="submit"
                              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                            >
                              {toggleLabel}
                            </button>
                          </form>
                          <ListingForm
                            propertyId={propertyId}
                            orgId={callerPerson.org_id}
                            units={unitsList}
                            existingListing={{
                              id: listing.id,
                              unit_id: listing.unit_id,
                              listing_title: listing.listing_title,
                              listing_description: listing.listing_description,
                              highlights: listing.highlights,
                              display_rent: listing.display_rent,
                              available_from: listing.available_from,
                              listing_status: listing.status,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Create additional listing */}
              {isManager && (
                <div className="pt-2">
                  <ListingForm
                    propertyId={propertyId}
                    orgId={callerPerson.org_id}
                    units={unitsList}
                  />
                </div>
              )}
            </div>
          )}
        </TabsContent>
        {/* Announcements Tab */}
        <TabsContent value="announcements">
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <AnnouncementsSection
              propertyId={propertyId}
              announcements={announcementsList}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
