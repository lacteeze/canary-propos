// src/lib/canary/load-db.ts
// Loads live Supabase data (scoped by RLS for the signed-in user) and maps it
// into the CanaryDb shape consumed by the CanaryApp client.
import { createClient } from '@/lib/supabase/server'
import { normalizeLeaseTermType } from './lease-term'
import type {
  CanaryDb,
  CanaryDraft,
  CanaryInquiry,
  CanaryLease,
  CanaryPayment,
  CanaryPerson,
  CanaryPortfolio,
  CanaryProject,
  CanaryProperty,
  DraftListingStatus,
  InquiryStatus,
  InquiryType,
} from './types'

const EXPIRY_WINDOW_DAYS = 90

type Caller = {
  personId: string
  orgId: string
  roles: string[]
  name: string
}

function fullAddress(street: string, city: string | null): string {
  return city ? `${street}, ${city}` : street
}

/** Match property/lease timeline keys — include unit suffix only for multi-unit buildings. */
function unitDisplayStreet(
  streetAddress: string,
  unitNumber: string | null | undefined,
  propertyId: string,
  allUnits: Array<{ properties?: { id: string } | null; unit_number?: string | null }>
): string {
  if (unitNumber && allUnits.filter((u) => u.properties?.id === propertyId).length > 1) {
    return `${streetAddress} · Unit ${unitNumber}`
  }
  return streetAddress
}

function unitStatusLabel(status: string | null): string {
  if (status === 'occupied') return 'Leased'
  if (status === 'maintenance') return 'Maintenance'
  return 'Vacant'
}

function leaseStatusLabel(
  start: string,
  end: string | null,
  dbStatus: string,
  termType: string | null | undefined
): string {
  if (dbStatus === 'terminated') return 'Terminated'
  if (dbStatus === 'expired') return 'Expired'
  const now = new Date()
  const s = new Date(start)
  if (Number.isNaN(s.getTime())) return 'Active'
  if (s > now) return 'Upcoming'
  if (!end) return 'Active'
  const e = new Date(end)
  if (Number.isNaN(e.getTime())) return 'Active'
  if (e < now) return 'Past'
  const soon = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 864e5)
  if (e <= soon && normalizeLeaseTermType(termType) !== 'month_to_month') return 'Expiring'
  return 'Active'
}

const WORK_ORDER_STATUS_LABEL: Record<string, string> = {
  draft: 'Estimate',
  submitted: 'Requires Estimate',
  assigned: 'Approved to Schedule',
  in_progress: 'In Progress',
  pending_approval: 'Reviewing Estimates',
  approved: 'Approved to Schedule',
  completed: 'Completed',
  closed: 'Closed',
}

const WORK_ORDER_PRIORITY_LABEL: Record<string, string> = {
  urgent: '1 - Urgent',
  high: '2 - High',
  medium: '3 - Medium',
  low: '4 - Low',
}

function personRoleLabel(roles: string[] | null): string {
  const r = roles?.[0] ?? ''
  if (r === 'owner') return 'Client'
  if (r === 'tenant') return 'Tenant'
  if (r === 'vendor') return 'Vendor'
  if (r === 'employee') return 'Admin'
  if (r === 'manager') return 'Admin'
  if (r === 'admin') return 'Admin'
  if (r === 'realtor') return 'Realtor'
  if (r === 'accountant') return 'Accountant'
  return r ? r[0].toUpperCase() + r.slice(1) : 'Contact'
}

function petsLabel(amenities: string[] | null, description: string | null): string {
  const text = [...(amenities ?? []), description ?? ''].join(' ')
  if (/by\s*approval|considered/i.test(text)) return 'By approval'
  if (/dog\s*friendly/i.test(text)) return 'Dog friendly'
  if (/cat\s*friendly/i.test(text)) return 'Cat friendly'
  if (/pet\s*friendly|pets?\s*(allowed|welcome)/i.test(text)) return 'Pet friendly'
  return 'No pets'
}

function utilitiesLabel(description: string | null): string {
  if (!description) return 'Not included'
  if (/utilities?\s+included/i.test(description) && !/not\s+included/i.test(description)) {
    return 'Included'
  }
  return 'Not included'
}

export async function getCaller(): Promise<Caller | 'no-user' | 'no-person'> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 'no-user'

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role, first_name, last_name, email')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return 'no-person'
  return {
    personId: person.id,
    orgId: person.org_id,
    roles: (person.role as unknown as string[]) ?? [],
    name:
      [person.first_name, person.last_name].filter(Boolean).join(' ') ||
      person.email,
  }
}

export async function loadCanaryDb(orgId: string): Promise<CanaryDb> {
  const supabase = await createClient()

  const [unitsRes, leasesRes, portfoliosRes, workOrdersRes, peopleRes, listingsRes, inquiriesRes, paymentsRes, expensesRes, mediaRes] =
    await Promise.all([
      supabase
        .from('units')
        .select(
          `id, unit_number, bedrooms, bathrooms, status, asking_rent, amenities, hospitable_property_id, archived_at,
           properties!property_id(id, street_address, city, province, property_type, portfolio_id, owner_id, management_fee_type, management_fee_value)`
        )
        .eq('org_id', orgId),
      supabase
        .from('leases')
        .select(
          `id, start_date, end_date, lease_term_type, monthly_rent, deposit_amount, status, renewal_status, proposed_rent,
           utilities_included, rental_credit, rental_credit_expiry, notes, lease_months,
           insurance_required, insurance_confirmed, policy_expires, insurance_details,
           management_start_date, management_end_date, management_fee_percent, leasing_fee_percent,
           termination_reason, days_occupied, pets_policy, bedrooms, bathrooms, parking_spots,
           appsheet_unique_id, portfolio_appsheet_id, folder_id, previous_lease_appsheet_id,
           tenant_contacts_raw, appsheet_tenant_ids, appsheet_viewer_ids,
           tenant_id, people!tenant_id(id, first_name, last_name, email, phone),
           units!unit_id(id, unit_number, properties!property_id(street_address, city))`
        )
        .eq('org_id', orgId),
      supabase
        .from('portfolios')
        .select('id, name, owner_id, created_at')
        .eq('org_id', orgId),
      supabase
        .from('work_orders')
        .select(
          `id, title, description, priority, status, estimated_cost, property_id,
           assigned_vendor_id, people!assigned_vendor_id(first_name, last_name),
           properties!property_id(street_address, city)`
        )
        .eq('org_id', orgId),
      supabase
        .from('people')
        .select(
          `id, first_name, last_name, email, phone, role, active, company, mailing_address,
           website, services, rating, notes, status, min_bedrooms, min_bathrooms, min_parking,
           pet_preference, move_in_date, lease_type, max_price`
        )
        .eq('org_id', orgId),
      supabase
        .from('listings')
        .select(
          `id, listing_title, listing_description, display_rent, status, available_from, updated_at,
           units!unit_id(id, unit_number, bedrooms, bathrooms, amenities,
             properties!property_id(id, street_address, city))`
        )
        .eq('org_id', orgId)
        .in('status', ['draft', 'published', 'renewal_sent']),
      supabase
        .from('inquiries')
        .select(
          `id, listing_id, type, name, email, phone, status, created_at, move_in_date,
           listings!listing_id(
             id,
             units!unit_id(
               properties!property_id(street_address, city)
             )
           )`
        )
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('payments')
        .select(
          `id, amount, method, status, notes, created_at,
           leases!lease_id(id, units!unit_id(properties!property_id(street_address, city)))`
        )
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('expenses')
        .select(
          `id, description, billed_amount, expense_date,
           properties!property_id(street_address, city)`
        )
        .eq('org_id', orgId)
        .order('expense_date', { ascending: false })
        .limit(500),
      supabase
        .from('property_media')
        .select('property_id, storage_path, visibility, sort_order')
        .eq('org_id', orgId)
        .order('sort_order', { ascending: true }),
    ])

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const unitRows = (unitsRes.data ?? []) as any[]
  const leaseRows = (leasesRes.data ?? []) as any[]
  const portfolioRows = (portfoliosRes.data ?? []) as any[]
  const workOrderRows = (workOrdersRes.data ?? []) as any[]
  const peopleRows = (peopleRes.data ?? []) as any[]
  const listingRows = (listingsRes.data ?? []) as any[]
  const inquiryRows = (inquiriesRes.data ?? []) as any[]
  const paymentRows = (paymentsRes.data ?? []) as any[]
  const expenseRows = (expensesRes.data ?? []) as any[]
  const mediaRows = (mediaRes.data ?? []) as any[]
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (listingsRes.error) {
    console.error('[loadCanaryDb:listings]', listingsRes.error.message)
  }
  if (mediaRes.error) {
    console.error('[loadCanaryDb:property_media]', mediaRes.error.message)
  }

  const listingPhotosByProperty = new Map<string, string[]>()
  const privatePhotosByProperty = new Map<string, string[]>()
  for (const row of mediaRows) {
    const map = row.visibility === 'private' ? privatePhotosByProperty : listingPhotosByProperty
    const list = map.get(row.property_id) ?? []
    list.push(row.storage_path)
    map.set(row.property_id, list)
  }

  const properties: CanaryProperty[] = unitRows
    .filter((u) => u.properties)
    .map((u) => {
      const p = u.properties
      const street =
        u.unit_number && unitRows.filter((x) => x.properties?.id === p.id).length > 1
          ? `${p.street_address} · Unit ${u.unit_number}`
          : p.street_address
      const feeLabel =
        p.management_fee_value != null
          ? p.management_fee_type === 'percent'
            ? `${p.management_fee_value}%`
            : `$${p.management_fee_value}`
          : ''
      return {
        id: u.id,
        unitId: u.id,
        propertyDbId: p.id,
        address: fullAddress(street, p.city),
        status: unitStatusLabel(u.status),
        beds: u.bedrooms != null ? String(u.bedrooms) : '',
        baths: u.bathrooms != null ? String(u.bathrooms).replace(/\.0$/, '') : '',
        parking: '',
        rate: u.asking_rent != null ? Number(u.asking_rent) : null,
        city: p.city ?? '',
        area: p.province ?? '',
        type: (p.property_type ?? '').replace(/_/g, ' '),
        availableDate: '',
        petFriendly: petsLabel(u.amenities, null),
        utilitiesIncluded: '',
        description: '',
        portfolioId: p.portfolio_id ?? '',
        ownerId: p.owner_id ?? '',
        mgmtFee: feeLabel,
        mgmtFeeType: p.management_fee_type ?? 'percent',
        mgmtFeeValue: p.management_fee_value != null ? String(Number(p.management_fee_value)) : '',
        hospitablePropertyId: u.hospitable_property_id?.trim() ?? '',
        archivedAt: u.archived_at ?? null,
        listingPhotoPaths: listingPhotosByProperty.get(p.id) ?? [],
        privatePhotoPaths: privatePhotosByProperty.get(p.id) ?? [],
      }
    })

  const archivedAddresses = new Set(
    properties.filter((p) => p.archivedAt).map((p) => p.address)
  )

  const leases: CanaryLease[] = leaseRows
    .filter((l) => l.units?.properties)
    .filter((l) => {
      const prop = l.units.properties
      const street =
        l.units.unit_number ? `${prop.street_address} · Unit ${l.units.unit_number}` : prop.street_address
      return !archivedAddresses.has(fullAddress(street, prop.city))
    })
    .map((l) => {
      const prop = l.units.properties
      const street =
        l.units.unit_number ? `${prop.street_address} · Unit ${l.units.unit_number}` : prop.street_address
      const tenant = l.people
      const tenantName = tenant
        ? [tenant.first_name, tenant.last_name].filter(Boolean).join(' ') || tenant.email
        : ''
      const months =
        l.lease_months != null
          ? String(l.lease_months)
          : l.start_date && l.end_date
            ? String(
                Math.max(
                  1,
                  Math.round(
                    (new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) / (30.44 * 864e5)
                  )
                )
              )
            : ''
      return {
        id: l.id,
        property: fullAddress(street, prop.city),
        status: leaseStatusLabel(l.start_date, l.end_date, l.status, l.lease_term_type),
        termType: normalizeLeaseTermType(l.lease_term_type),
        start: l.start_date ?? '',
        end: l.end_date ?? '',
        rent: l.monthly_rent != null ? `$${Number(l.monthly_rent).toLocaleString('en-CA')}` : '',
        tenantInfo: l.tenant_contacts_raw?.trim()
          ? l.tenant_contacts_raw
          : tenant
            ? [tenantName, tenant.email, tenant.phone].filter(Boolean).join(': ')
            : '',
        tenantIds: l.tenant_id ?? '',
        months,
        deposit: l.deposit_amount != null ? `$${Number(l.deposit_amount).toLocaleString('en-CA')}` : '',
        renewal: l.renewal_status ?? '',
        utilities: l.utilities_included?.trim() || '',
        notes: l.notes?.trim() || '',
        rentalCredit:
          l.rental_credit != null ? `$${Number(l.rental_credit).toLocaleString('en-CA')}` : '',
        rentalCreditExpiry: l.rental_credit_expiry ?? '',
        utilitiesIncluded: l.utilities_included?.trim() || '',
        petsPolicy: l.pets_policy?.trim() || '',
        insuranceRequired: l.insurance_required ? 'TRUE' : 'FALSE',
        insuranceConfirmed: l.insurance_confirmed ? 'TRUE' : 'FALSE',
        policyExpires: l.policy_expires ?? '',
        insuranceDetails: l.insurance_details?.trim() || '',
        managementStart: l.management_start_date ?? '',
        managementEnd: l.management_end_date ?? '',
        managementFeePercent:
          l.management_fee_percent != null ? `${Number(l.management_fee_percent)}%` : '',
        leasingFeePercent:
          l.leasing_fee_percent != null ? `${Number(l.leasing_fee_percent)}%` : '',
        terminationReason: l.termination_reason?.trim() || '',
        daysOccupied: l.days_occupied != null ? String(l.days_occupied) : '',
        appsheetUniqueId: l.appsheet_unique_id?.trim() || '',
        portfolioAppsheetId: l.portfolio_appsheet_id?.trim() || '',
        folderId: l.folder_id?.trim() || '',
        previousLeaseAppsheetId: l.previous_lease_appsheet_id?.trim() || '',
        tenantContactsRaw: l.tenant_contacts_raw?.trim() || '',
        appsheetTenantIds: (l.appsheet_tenant_ids ?? []).join(', '),
        appsheetViewerIds: (l.appsheet_viewer_ids ?? []).join(', '),
        bedrooms: l.bedrooms != null ? String(l.bedrooms) : '',
        bathrooms: l.bathrooms != null ? String(l.bathrooms) : '',
        parkingSpots: l.parking_spots != null ? String(l.parking_spots) : '',
      }
    })

  const portfolios: CanaryPortfolio[] = portfolioRows.map((pf) => ({
    id: pf.id,
    name: pf.name,
    ownerIds: pf.owner_id ?? '',
    status: 'Active',
    leasingFee: '',
    longFee: '',
    shortFee: '',
    startDate: pf.created_at ? String(pf.created_at).slice(0, 10) : '',
    notes: '',
  }))

  const projects: CanaryProject[] = workOrderRows
    .filter((j) => j.properties)
    .filter((j) => !archivedAddresses.has(fullAddress(j.properties.street_address, j.properties.city)))
    .map((j) => {
      const vendor = j.people
      const vendorName = vendor
        ? [vendor.first_name, vendor.last_name].filter(Boolean).join(' ')
        : ''
      return {
        id: j.id,
        propertyDbId: j.property_id ?? '',
        name: j.title,
        property: fullAddress(j.properties.street_address, j.properties.city),
        status: WORK_ORDER_STATUS_LABEL[j.status] ?? j.status,
        priority: WORK_ORDER_PRIORITY_LABEL[j.priority] ?? j.priority,
        description: j.description ?? '',
        contractors: vendorName,
        estimate:
          j.estimated_cost != null ? `$${Number(j.estimated_cost).toLocaleString('en-CA')}` : '',
      }
    })

  const people: CanaryPerson[] = peopleRows.map((p) => ({
    id: p.id,
    name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email,
    roles: (p.role as unknown as string[]) ?? [],
    role: personRoleLabel(p.role as unknown as string[]),
    email: p.email ?? '',
    phone: p.phone ?? '',
    company: p.company ?? '',
    status: p.status || (p.active ? 'Active' : 'Inactive'),
    address: p.mailing_address ?? '',
    website: p.website ?? '',
    services: p.services ?? '',
    rating: p.rating != null ? String(Number(p.rating)) : '',
    notes: p.notes ?? '',
    minBeds: p.min_bedrooms != null ? String(p.min_bedrooms) : '',
    minBaths: p.min_bathrooms != null ? String(Number(p.min_bathrooms)).replace(/\.0$/, '') : '',
    minParking: p.min_parking != null ? String(p.min_parking) : '',
    pets: p.pet_preference ?? '',
    moveIn: p.move_in_date ?? '',
    leaseType: p.lease_type ?? '',
    maxPrice: p.max_price != null ? String(Number(p.max_price)) : '',
  }))

  const drafts: CanaryDraft[] = listingRows
    .filter((d) => d.units?.properties)
    .map((d) => {
      const prop = d.units.properties
      const street = unitDisplayStreet(prop.street_address, d.units.unit_number, prop.id, unitRows)
      return { d, prop, street, address: fullAddress(street, prop.city) }
    })
    .filter(({ address }) => !archivedAddresses.has(address))
    .map(({ d, address }) => ({
      id: d.id,
      propId: d.units.id,
      unitId: d.units.id,
      address,
      rent: d.display_rent != null ? String(Number(d.display_rent)) : '',
      start: d.available_from ?? '',
      end: '',
      beds: d.units.bedrooms != null ? String(d.units.bedrooms) : '',
      baths: d.units.bathrooms != null ? String(d.units.bathrooms).replace(/\.0$/, '') : '',
      parking: '',
      pets: petsLabel(d.units.amenities, d.listing_description),
      utilities: utilitiesLabel(d.listing_description),
      description: d.listing_description ?? '',
      status: (d.status === 'renewal_sent' ? 'renewal_sent' : d.status === 'published' ? 'published' : 'draft') as DraftListingStatus,
      sentAt: d.updated_at ? String(d.updated_at).slice(0, 10) : '',
    }))

  const inquiries: CanaryInquiry[] = inquiryRows
    .filter((i) => i.listings?.units?.properties)
    .map((i) => ({
      id: i.id,
      listingId: i.listing_id,
      type: i.type as InquiryType,
      name: i.name,
      email: i.email,
      phone: i.phone ?? '',
      status: i.status as InquiryStatus,
      submittedAt: String(i.created_at),
      property: fullAddress(i.listings.units.properties.street_address, i.listings.units.properties.city),
      moveIn: i.move_in_date ?? '',
    }))

  const payments: CanaryPayment[] = [
    ...paymentRows
      .filter((p) => p.leases?.units?.properties)
      .map((p): CanaryPayment => ({
        id: p.id,
        date: String(p.created_at).slice(0, 10),
        property: fullAddress(p.leases.units.properties.street_address, p.leases.units.properties.city),
        category: 'Rent Payment',
        description: p.notes ?? `${p.method} · ${p.status}`,
        amount: String(Number(p.amount)),
        type: 'Credit',
        persisted: true,
      })),
    ...expenseRows
      .filter((e) => e.properties)
      .map((e): CanaryPayment => ({
        id: e.id,
        date: e.expense_date ?? '',
        property: fullAddress(e.properties.street_address, e.properties.city),
        category: 'Maintenance',
        description: e.description ?? '',
        amount: String(Number(e.billed_amount)),
        type: 'Debit',
        persisted: true,
      })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1))

  return { orgId, properties, leases, portfolios, projects, people, drafts, payments, inquiries }
}
