'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { str, writeAuditEntries } from '@/lib/canary/audit'
import { addressesMatch, formatPropertyAddress } from '@/lib/canary/property-ops'
import { normalizeLeaseTermType, validateLeaseDates } from '@/lib/canary/lease-term'
import type { LeaseTermType } from '@/lib/canary/lease-term'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

type UnitUpdate = Database['public']['Tables']['units']['Update']
type PropertyUpdate = Database['public']['Tables']['properties']['Update']
type LeaseUpdate = Database['public']['Tables']['leases']['Update']
type PersonUpdate = Database['public']['Tables']['people']['Update']
type WorkOrderUpdate = Database['public']['Tables']['work_orders']['Update']

type ActionResult = { success: true } | { success: false; error: string }

export type AuditEntry = {
  id: string
  fieldName: string
  oldValue: string | null
  newValue: string | null
  changedByName: string
  changedAt: string
}

async function getStaffContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role, first_name, last_name, email')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  const roles = (person.role as unknown as string[]) ?? []
  if (!roles.includes('manager') && !roles.includes('admin')) return null
  return { supabase, person }
}

export async function getAuditLog(tableName: string, recordId: string): Promise<AuditEntry[]> {
  const ctx = await getStaffContext()
  if (!ctx) return []

  const { data } = await ctx.supabase
    .from('audit_log')
    .select('id, field_name, old_value, new_value, changed_at, people!changed_by(first_name, last_name, email)')
    .eq('table_name', tableName)
    .eq('record_id', recordId)
    .eq('org_id', ctx.person.org_id)
    .order('changed_at', { ascending: false })
    .limit(100)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((row: any) => {
    const p = row.people
    const name = p
      ? [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
      : 'System'
    return {
      id: row.id,
      fieldName: row.field_name,
      oldValue: row.old_value,
      newValue: row.new_value,
      changedByName: name,
      changedAt: row.changed_at,
    }
  })
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

const UNIT_STATUS_MAP: Record<string, string> = {
  Vacant: 'vacant',
  Leased: 'occupied',
  Maintenance: 'maintenance',
  STR: 'str',
  Airbnb: 'str',
  Office: 'office',
}

const UNIT_STATUS_REVERSE: Record<string, string> = {
  vacant: 'Vacant',
  occupied: 'Leased',
  maintenance: 'Maintenance',
  str: 'STR',
  office: 'Office',
}

const UNIT_DB_STATUSES = ['vacant', 'occupied', 'maintenance', 'str', 'office'] as const

export async function updatePropertyField(
  unitId: string,
  field: 'status' | 'asking_rent' | 'bedrooms' | 'bathrooms' | 'hospitable_property_id' | 'property_type',
  value: string
): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can edit properties.' }

  const { data: unit } = await ctx.supabase
    .from('units')
    .select('id, property_id, status, asking_rent, bedrooms, bathrooms, hospitable_property_id')
    .eq('id', unitId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!unit) return { success: false, error: 'Property not found.' }

  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = []
  const patch: UnitUpdate = { updated_at: new Date().toISOString() }

  if (field === 'property_type') {
    const PROPERTY_TYPES = ['house', 'duplex', 'apartment_building', 'condo', 'townhouse', 'other'] as const
    const next = value.trim().replace(/ /g, '_')
    if (!(PROPERTY_TYPES as readonly string[]).includes(next)) {
      return { success: false, error: 'Invalid property type.' }
    }
    if (!unit.property_id) return { success: false, error: 'Property not found.' }
    const { data: prop } = await ctx.supabase
      .from('properties')
      .select('id, property_type')
      .eq('id', unit.property_id)
      .eq('org_id', ctx.person.org_id)
      .single()
    if (!prop) return { success: false, error: 'Property not found.' }
    if (prop.property_type === next) return { success: true }
    const { error } = await ctx.supabase
      .from('properties')
      .update({ property_type: next, updated_at: new Date().toISOString() })
      .eq('id', prop.id)
      .eq('org_id', ctx.person.org_id)
    if (error) {
      console.error('[updatePropertyField]', error)
      return { success: false, error: 'Failed to update property type.' }
    }
    // Record against the unit so it surfaces in the drawer audit log.
    await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'units', unitId, ctx.person.id, [
      { field: 'type', oldValue: prop.property_type, newValue: next },
    ])
    revalidatePath('/app')
    return { success: true }
  }

  if (field === 'status') {
    const dbVal = UNIT_STATUS_MAP[value] ?? value.toLowerCase()
    if (!(UNIT_DB_STATUSES as readonly string[]).includes(dbVal)) {
      return { success: false, error: 'Invalid status.' }
    }
    changes.push({ field: 'status', oldValue: UNIT_STATUS_REVERSE[unit.status] ?? unit.status, newValue: value })
    patch.status = dbVal as UnitUpdate['status']
  } else if (field === 'asking_rent') {
    const n = parseFloat(value.replace(/[$,]/g, ''))
    if (Number.isNaN(n) || n < 0) return { success: false, error: 'Invalid rent amount.' }
    changes.push({ field: 'asking_rent', oldValue: str(unit.asking_rent), newValue: String(n) })
    patch.asking_rent = n
  } else if (field === 'bedrooms') {
    const n = parseInt(value, 10)
    if (Number.isNaN(n) || n < 0) return { success: false, error: 'Invalid bedroom count.' }
    changes.push({ field: 'bedrooms', oldValue: str(unit.bedrooms), newValue: String(n) })
    patch.bedrooms = n
  } else if (field === 'bathrooms') {
    const n = parseFloat(value)
    if (Number.isNaN(n) || n < 0) return { success: false, error: 'Invalid bathroom count.' }
    changes.push({ field: 'bathrooms', oldValue: str(unit.bathrooms), newValue: String(n) })
    patch.bathrooms = n
  } else if (field === 'hospitable_property_id') {
    const trimmed = value.trim()
    if (trimmed && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return { success: false, error: 'Hospitable property ID must be a UUID (or leave blank to clear).' }
    }
    const next = trimmed || null
    const prev = unit.hospitable_property_id?.trim() || null
    if (next === prev) return { success: true }
    changes.push({ field: 'hospitable_property_id', oldValue: prev, newValue: next })
    patch.hospitable_property_id = next
  }

  const { error } = await ctx.supabase.from('units').update(patch).eq('id', unitId).eq('org_id', ctx.person.org_id)
  if (error) {
    console.error('[updatePropertyField]', error)
    if (error.code === '23505') {
      return { success: false, error: 'That Hospitable property is already linked to another unit.' }
    }
    return { success: false, error: 'Failed to update property.' }
  }
  await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'units', unitId, ctx.person.id, changes)
  revalidatePath('/app')
  return { success: true }
}

const PET_LABELS = ['No pets', 'Pet friendly', 'Cat friendly', 'Dog friendly', 'By approval'] as const
const PET_AMENITY_RE = /pet|cat|dog|approval/i

const propertyDetailsSchema = z.object({
  status: z.enum(['Vacant', 'Leased', 'Maintenance', 'STR', 'Office']),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().min(0).max(50),
  askingRent: z.number().min(0).nullable(),
  pets: z.enum(PET_LABELS),
  propertyType: z.enum(['house', 'duplex', 'apartment_building', 'condo', 'townhouse', 'other']),
  city: z.string().trim().max(120),
  province: z.string().trim().max(120),
  portfolioId: z.string().uuid().nullable(),
  ownerId: z.string().uuid().nullable(),
  managementFeeType: z.enum(['percent', 'flat']),
  managementFeeValue: z.number().min(0).nullable(),
  hospitablePropertyId: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.string().uuid().nullable()
  ),
})

export type PropertyDetailsInput = z.infer<typeof propertyDetailsSchema>

export async function updatePropertyDetails(unitId: string, input: PropertyDetailsInput): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can edit properties.' }

  const parsed = propertyDetailsSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid form values.' }
  const form = parsed.data

  const { data: unit } = await ctx.supabase
    .from('units')
    .select('id, property_id, status, bedrooms, bathrooms, asking_rent, amenities, hospitable_property_id')
    .eq('id', unitId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!unit || !unit.property_id) return { success: false, error: 'Property not found.' }

  const { data: prop } = await ctx.supabase
    .from('properties')
    .select('id, property_type, city, province, portfolio_id, owner_id, management_fee_type, management_fee_value')
    .eq('id', unit.property_id)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!prop) return { success: false, error: 'Property not found.' }

  // Validate portfolio / owner belong to this org before assignment.
  if (form.portfolioId) {
    const { data: pf } = await ctx.supabase
      .from('portfolios').select('id').eq('id', form.portfolioId).eq('org_id', ctx.person.org_id).maybeSingle()
    if (!pf) return { success: false, error: 'Portfolio not found.' }
  }
  if (form.ownerId) {
    const { data: ow } = await ctx.supabase
      .from('people').select('id').eq('id', form.ownerId).eq('org_id', ctx.person.org_id).maybeSingle()
    if (!ow) return { success: false, error: 'Owner not found.' }
  }

  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = []
  const now = new Date().toISOString()

  // ----- units patch -----
  const unitPatch: UnitUpdate = { updated_at: now }
  const newStatus = UNIT_STATUS_MAP[form.status]
  if (newStatus !== unit.status) {
    changes.push({ field: 'status', oldValue: UNIT_STATUS_REVERSE[unit.status] ?? unit.status, newValue: form.status })
    unitPatch.status = newStatus as UnitUpdate['status']
  }
  if (form.bedrooms !== (unit.bedrooms ?? 0)) {
    changes.push({ field: 'bedrooms', oldValue: str(unit.bedrooms), newValue: String(form.bedrooms) })
    unitPatch.bedrooms = form.bedrooms
  }
  if (form.bathrooms !== Number(unit.bathrooms ?? 0)) {
    changes.push({ field: 'bathrooms', oldValue: str(unit.bathrooms), newValue: String(form.bathrooms) })
    unitPatch.bathrooms = form.bathrooms
  }
  const oldRent = unit.asking_rent != null ? Number(unit.asking_rent) : null
  if (form.askingRent !== oldRent) {
    changes.push({ field: 'asking_rent', oldValue: str(oldRent), newValue: str(form.askingRent) })
    unitPatch.asking_rent = form.askingRent
  }
  const amenities: string[] = (unit.amenities as string[] | null) ?? []
  const nonPet = amenities.filter((a) => !PET_AMENITY_RE.test(a))
  const oldPetLabel = amenities.length !== nonPet.length ? amenities.find((a) => PET_AMENITY_RE.test(a)) ?? 'No pets' : 'No pets'
  if (form.pets !== oldPetLabel && !(form.pets === 'No pets' && amenities.length === nonPet.length)) {
    changes.push({ field: 'pets', oldValue: oldPetLabel, newValue: form.pets })
    unitPatch.amenities = form.pets === 'No pets' ? nonPet : [...nonPet, form.pets]
  }
  const oldHospitableId = unit.hospitable_property_id?.trim() || null
  if (form.hospitablePropertyId !== oldHospitableId) {
    changes.push({
      field: 'hospitable_property_id',
      oldValue: oldHospitableId,
      newValue: form.hospitablePropertyId,
    })
    unitPatch.hospitable_property_id = form.hospitablePropertyId
  }

  // ----- properties patch -----
  const propPatch: PropertyUpdate = { updated_at: now }
  if (form.propertyType !== prop.property_type) {
    changes.push({ field: 'type', oldValue: prop.property_type, newValue: form.propertyType })
    propPatch.property_type = form.propertyType
  }
  if (form.city !== (prop.city ?? '')) {
    changes.push({ field: 'city', oldValue: prop.city, newValue: form.city || null })
    propPatch.city = form.city || undefined
  }
  if (form.province !== (prop.province ?? '')) {
    changes.push({ field: 'province', oldValue: prop.province, newValue: form.province || null })
    propPatch.province = form.province || undefined
  }
  if (form.portfolioId !== (prop.portfolio_id ?? null)) {
    changes.push({ field: 'portfolio', oldValue: prop.portfolio_id, newValue: form.portfolioId })
    propPatch.portfolio_id = form.portfolioId
  }
  if (form.ownerId !== (prop.owner_id ?? null)) {
    changes.push({ field: 'owner', oldValue: prop.owner_id, newValue: form.ownerId })
    propPatch.owner_id = form.ownerId
  }
  const oldFeeValue = prop.management_fee_value != null ? Number(prop.management_fee_value) : null
  if (form.managementFeeType !== (prop.management_fee_type ?? 'percent') || form.managementFeeValue !== oldFeeValue) {
    const fmt = (t: string | null, v: number | null) => (v == null ? null : t === 'percent' ? `${v}%` : `$${v}`)
    changes.push({
      field: 'management_fee',
      oldValue: fmt(prop.management_fee_type, oldFeeValue),
      newValue: fmt(form.managementFeeType, form.managementFeeValue),
    })
    propPatch.management_fee_type = form.managementFeeType
    propPatch.management_fee_value = form.managementFeeValue
  }

  if (!changes.length) return { success: true }

  if (Object.keys(unitPatch).length > 1) {
    const { error } = await ctx.supabase.from('units').update(unitPatch).eq('id', unitId).eq('org_id', ctx.person.org_id)
    if (error) {
      console.error('[updatePropertyDetails:units]', error)
      if (error.code === '23505') {
        return { success: false, error: 'That Hospitable property is already linked to another unit.' }
      }
      return { success: false, error: 'Failed to update property.' }
    }
  }
  if (Object.keys(propPatch).length > 1) {
    const { error } = await ctx.supabase
      .from('properties').update(propPatch).eq('id', unit.property_id).eq('org_id', ctx.person.org_id)
    if (error) {
      console.error('[updatePropertyDetails:properties]', error)
      return { success: false, error: 'Failed to update property.' }
    }
  }

  // All entries recorded against the unit so they surface in the drawer audit log.
  await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'units', unitId, ctx.person.id, changes)
  revalidatePath('/app')
  return { success: true }
}

const WO_STATUS_REVERSE: Record<string, string> = {
  Estimate: 'draft',
  'Requires Estimate': 'submitted',
  'Approved to Schedule': 'approved',
  'In Progress': 'in_progress',
  'Reviewing Estimates': 'pending_approval',
  Completed: 'completed',
  Closed: 'closed',
  Postponed: 'postponed',
  Cancelled: 'cancelled',
}

const WO_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(WO_STATUS_REVERSE).map(([k, v]) => [v, k])
)

const WO_PRIORITY_REVERSE: Record<string, string> = {
  '1 - Urgent': 'urgent',
  '2 - High': 'high',
  '3 - Medium': 'medium',
  '4 - Low': 'low',
}

const WO_PRIORITY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(WO_PRIORITY_REVERSE).map(([k, v]) => [v, k])
)

export async function updateLeaseField(
  leaseId: string,
  field:
    | 'renewal_status'
    | 'monthly_rent'
    | 'deposit_amount'
    | 'start_date'
    | 'end_date'
    | 'status'
    | 'lease_term_type'
    | 'rental_credit'
    | 'rental_credit_expiry',
  value: string
): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can edit leases.' }

  const { data: lease } = await ctx.supabase
    .from('leases')
    .select('id, renewal_status, monthly_rent, deposit_amount, start_date, end_date, status, lease_term_type, rental_credit, rental_credit_expiry')
    .eq('id', leaseId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!lease) return { success: false, error: 'Lease not found.' }

  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = []
  const patch: LeaseUpdate = { updated_at: new Date().toISOString() }

  if (field === 'renewal_status') {
    const dbVal = value === '—' || value === '' ? null : value.toLowerCase()
    if (dbVal && !['pending', 'sent', 'accepted', 'declined'].includes(dbVal)) {
      return { success: false, error: 'Invalid renewal status.' }
    }
    changes.push({ field: 'renewal_status', oldValue: lease.renewal_status, newValue: dbVal })
    patch.renewal_status = dbVal as LeaseUpdate['renewal_status']
  } else if (field === 'monthly_rent') {
    const n = parseFloat(value.replace(/[$,]/g, ''))
    if (Number.isNaN(n) || n <= 0) return { success: false, error: 'Invalid rent amount.' }
    changes.push({ field: 'monthly_rent', oldValue: str(lease.monthly_rent), newValue: String(n) })
    patch.monthly_rent = n
  } else if (field === 'deposit_amount') {
    const n = parseFloat(value.replace(/[$,]/g, ''))
    if (Number.isNaN(n) || n < 0) return { success: false, error: 'Invalid deposit amount.' }
    changes.push({ field: 'deposit_amount', oldValue: str(lease.deposit_amount), newValue: String(n) })
    patch.deposit_amount = n
  } else if (field === 'rental_credit') {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '—') {
      changes.push({ field: 'rental_credit', oldValue: str(lease.rental_credit), newValue: null })
      patch.rental_credit = null
    } else {
      const n = parseFloat(trimmed.replace(/[$,]/g, ''))
      if (Number.isNaN(n) || n < 0) return { success: false, error: 'Invalid rental credit amount.' }
      changes.push({ field: 'rental_credit', oldValue: str(lease.rental_credit), newValue: String(n) })
      patch.rental_credit = n
    }
  } else if (field === 'rental_credit_expiry') {
    const trimmed = value.trim()
    if (!trimmed) {
      changes.push({ field: 'rental_credit_expiry', oldValue: str(lease.rental_credit_expiry), newValue: null })
      patch.rental_credit_expiry = null
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { success: false, error: 'Invalid date format.' }
      changes.push({ field: 'rental_credit_expiry', oldValue: str(lease.rental_credit_expiry), newValue: trimmed })
      patch.rental_credit_expiry = trimmed
    }
  } else if (field === 'start_date' || field === 'end_date') {
    const nextStart = field === 'start_date' ? value : (lease.start_date ?? '')
    const nextEnd = field === 'end_date' ? (value.trim() || null) : (lease.end_date ?? null)
    const termType = normalizeLeaseTermType(lease.lease_term_type) as LeaseTermType
    if (field === 'end_date' && !value.trim()) {
      if (termType === 'fixed_term') return { success: false, error: 'End date is required for fixed-term leases.' }
      changes.push({ field, oldValue: str(lease.end_date), newValue: null })
      patch.end_date = null
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { success: false, error: 'Invalid date format.' }
      const dateErr = validateLeaseDates(termType, nextStart, nextEnd)
      if (dateErr) return { success: false, error: dateErr }
      changes.push({ field, oldValue: str(lease[field]), newValue: value })
      patch[field] = value
    }
  } else if (field === 'lease_term_type') {
    const dbVal = normalizeLeaseTermType(value)
    const dateErr = validateLeaseDates(dbVal, lease.start_date ?? '', lease.end_date ?? null)
    if (dateErr) return { success: false, error: dateErr }
    changes.push({ field: 'lease_term_type', oldValue: lease.lease_term_type, newValue: dbVal })
    patch.lease_term_type = dbVal
  } else if (field === 'status') {
    const dbVal = value.toLowerCase()
    if (!['active', 'expired', 'terminated'].includes(dbVal)) {
      return { success: false, error: 'Invalid lease status.' }
    }
    changes.push({ field: 'status', oldValue: lease.status, newValue: dbVal })
    patch.status = dbVal as LeaseUpdate['status']
  }

  const { error } = await ctx.supabase.from('leases').update(patch).eq('id', leaseId).eq('org_id', ctx.person.org_id)
  if (error) {
    console.error('[updateLeaseField]', error)
    return { success: false, error: 'Failed to update lease.' }
  }
  await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'leases', leaseId, ctx.person.id, changes)
  revalidatePath('/app')
  return { success: true }
}

export async function deleteLease(leaseId: string): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can delete leases.' }

  const { data: lease } = await ctx.supabase
    .from('leases')
    .select('id, start_date, end_date, status, units!unit_id(properties!property_id(street_address, city))')
    .eq('id', leaseId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!lease) return { success: false, error: 'Lease not found.' }

  const blockers: string[] = []

  const { count: paymentCount } = await ctx.supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('lease_id', leaseId)
    .eq('org_id', ctx.person.org_id)
  if ((paymentCount ?? 0) > 0) blockers.push(`${paymentCount} payment record(s)`)

  const { count: checklistCount } = await ctx.supabase
    .from('checklists')
    .select('id', { count: 'exact', head: true })
    .eq('lease_id', leaseId)
    .eq('org_id', ctx.person.org_id)
  if ((checklistCount ?? 0) > 0) blockers.push(`${checklistCount} checklist(s)`)

  if (blockers.length) {
    return {
      success: false,
      error: `Cannot delete — remove linked records first: ${blockers.join(', ')}.`,
    }
  }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const unit = (lease as any).units
  const prop = unit?.properties
  const address = prop ? `${prop.street_address}, ${prop.city}` : leaseId
  const label = `${address} · ${lease.start_date}${lease.end_date ? ` → ${lease.end_date}` : ''}`

  await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'leases', leaseId, ctx.person.id, [
    { field: '_deleted', oldValue: label, newValue: null },
  ])

  const { error } = await ctx.supabase.from('leases').delete().eq('id', leaseId).eq('org_id', ctx.person.org_id)
  if (error) {
    console.error('[deleteLease]', error)
    if (error.code === '23503') {
      return { success: false, error: 'Cannot delete — this lease is referenced by other records.' }
    }
    return { success: false, error: 'Failed to delete lease.' }
  }

  revalidatePath('/app')
  return { success: true }
}

async function tenantDisplayName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  tenantId: string | null
): Promise<string | null> {
  if (!tenantId) return null
  const { data } = await supabase
    .from('people')
    .select('first_name, last_name, email')
    .eq('id', tenantId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (!data) return tenantId
  return [data.first_name, data.last_name].filter(Boolean).join(' ') || data.email
}

function splitPersonName(name: string): { first: string | null; last: string | null } {
  const full = name.trim()
  if (!full) return { first: null, last: null }
  const parts = full.split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: null }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

export async function updateLeaseTenant(
  leaseId: string,
  tenantId: string | null
): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can edit leases.' }

  const { data: lease } = await ctx.supabase
    .from('leases')
    .select('id, tenant_id')
    .eq('id', leaseId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!lease) return { success: false, error: 'Lease not found.' }

  if (tenantId) {
    const { data: tenant } = await ctx.supabase
      .from('people')
      .select('id, role')
      .eq('id', tenantId)
      .eq('org_id', ctx.person.org_id)
      .single()
    if (!tenant) return { success: false, error: 'Tenant not found.' }
    const roles = (tenant.role as unknown as string[]) ?? []
    if (!roles.includes('tenant')) {
      return { success: false, error: 'Selected person is not a tenant.' }
    }
  }

  const oldLabel = await tenantDisplayName(ctx.supabase, ctx.person.org_id, lease.tenant_id)
  const newLabel = tenantId ? await tenantDisplayName(ctx.supabase, ctx.person.org_id, tenantId) : null

  const patch: LeaseUpdate = {
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  } as LeaseUpdate

  const { error } = await ctx.supabase
    .from('leases')
    .update(patch)
    .eq('id', leaseId)
    .eq('org_id', ctx.person.org_id)
  if (error) {
    console.error('[updateLeaseTenant]', error)
    return { success: false, error: 'Failed to update lease tenant.' }
  }

  await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'leases', leaseId, ctx.person.id, [
    { field: 'tenant_id', oldValue: oldLabel, newValue: newLabel },
  ])
  revalidatePath('/app')
  return { success: true }
}

const createTenantForLeaseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().default(''),
})

export async function createTenantAndLinkToLease(
  leaseId: string,
  input: { name: string; email: string; phone?: string }
): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can edit leases.' }

  const parsed = createTenantForLeaseSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { data: lease } = await ctx.supabase
    .from('leases')
    .select('id, tenant_id')
    .eq('id', leaseId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!lease) return { success: false, error: 'Lease not found.' }

  const email = parsed.data.email.trim().toLowerCase()
  const { data: existing } = await ctx.supabase
    .from('people')
    .select('id, role, first_name, last_name, email')
    .eq('org_id', ctx.person.org_id)
    .eq('email', email)
    .maybeSingle()

  let tenantId: string

  if (existing) {
    const roles = (existing.role as unknown as string[]) ?? []
    if (!roles.includes('tenant')) {
      return {
        success: false,
        error: 'A person with this email exists but is not a tenant. Select them from the list or use a different email.',
      }
    }
    tenantId = existing.id
  } else {
    const { first, last } = splitPersonName(parsed.data.name)
    const { data: created, error: insertError } = await ctx.supabase
      .from('people')
      .insert({
        org_id: ctx.person.org_id,
        email,
        first_name: first,
        last_name: last,
        phone: parsed.data.phone?.trim() || null,
        role: ['tenant'],
        active: true,
        status: 'Active',
      })
      .select('id')
      .single()
    if (insertError || !created) {
      console.error('[createTenantAndLinkToLease] insert', insertError)
      return { success: false, error: 'Failed to create tenant.' }
    }
    tenantId = created.id
    await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'people', tenantId, ctx.person.id, [
      { field: 'created', oldValue: null, newValue: parsed.data.name.trim() },
    ])
  }

  if (lease.tenant_id === tenantId) {
    revalidatePath('/app')
    return { success: true }
  }

  const oldLabel = await tenantDisplayName(ctx.supabase, ctx.person.org_id, lease.tenant_id)
  const newLabel = await tenantDisplayName(ctx.supabase, ctx.person.org_id, tenantId)

  const { error: linkError } = await ctx.supabase
    .from('leases')
    .update({
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    } as LeaseUpdate)
    .eq('id', leaseId)
    .eq('org_id', ctx.person.org_id)
  if (linkError) {
    console.error('[createTenantAndLinkToLease] link', linkError)
    return { success: false, error: 'Tenant created but failed to link to lease.' }
  }

  await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'leases', leaseId, ctx.person.id, [
    { field: 'tenant_id', oldValue: oldLabel, newValue: newLabel },
  ])
  revalidatePath('/app')
  return { success: true }
}

export async function updatePersonField(
  personId: string,
  field: 'status' | 'email' | 'phone' | 'company' | 'notes' | 'mailing_address' | 'website' | 'services',
  value: string
): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can edit people.' }

  const { data: person } = await ctx.supabase
    .from('people')
    .select('id, status, email, phone, company, notes, mailing_address, website, services')
    .eq('id', personId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!person) return { success: false, error: 'Person not found.' }

  const changes = [{ field, oldValue: str(person[field as keyof typeof person]), newValue: value || null }]
  const patch: PersonUpdate = { [field]: value || null, updated_at: new Date().toISOString() } as PersonUpdate

  if (field === 'email' && value) {
    const emailSchema = z.string().email()
    if (!emailSchema.safeParse(value).success) return { success: false, error: 'Invalid email address.' }
  }

  const { error } = await ctx.supabase.from('people').update(patch).eq('id', personId).eq('org_id', ctx.person.org_id)
  if (error) {
    console.error('[updatePersonField]', error)
    return { success: false, error: 'Failed to update person.' }
  }
  await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'people', personId, ctx.person.id, changes)
  revalidatePath('/app')
  return { success: true }
}

export async function updatePortfolioField(
  portfolioId: string,
  field: 'name',
  value: string
): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can edit portfolios.' }

  const { data: pf } = await ctx.supabase
    .from('portfolios')
    .select('id, name')
    .eq('id', portfolioId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!pf) return { success: false, error: 'Portfolio not found.' }

  if (!value.trim()) return { success: false, error: 'Name is required.' }

  const changes = [{ field: 'name', oldValue: pf.name, newValue: value.trim() }]
  const { error } = await ctx.supabase
    .from('portfolios')
    .update({ name: value.trim(), updated_at: new Date().toISOString() })
    .eq('id', portfolioId)
    .eq('org_id', ctx.person.org_id)
  if (error) {
    console.error('[updatePortfolioField]', error)
    return { success: false, error: 'Failed to update portfolio.' }
  }
  await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'portfolios', portfolioId, ctx.person.id, changes)
  revalidatePath('/app')
  return { success: true }
}

export async function updateProjectField(
  projectId: string,
  field: 'status' | 'priority' | 'title' | 'description' | 'estimated_cost',
  value: string
): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can edit projects.' }

  const { data: wo } = await ctx.supabase
    .from('work_orders')
    .select('id, status, priority, title, description, estimated_cost')
    .eq('id', projectId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!wo) return { success: false, error: 'Project not found.' }

  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = []
  const patch: WorkOrderUpdate = { updated_at: new Date().toISOString() }

  if (field === 'status') {
    const dbVal = (WO_STATUS_REVERSE[value] ?? value.toLowerCase().replace(/ /g, '_')) as WorkOrderUpdate['status']
    changes.push({ field: 'status', oldValue: WO_STATUS_LABEL[wo.status] ?? wo.status, newValue: value })
    patch.status = dbVal
  } else if (field === 'priority') {
    const dbVal = (WO_PRIORITY_REVERSE[value] ?? value.toLowerCase()) as WorkOrderUpdate['priority']
    changes.push({ field: 'priority', oldValue: WO_PRIORITY_LABEL[wo.priority] ?? wo.priority, newValue: value })
    patch.priority = dbVal
  } else if (field === 'title') {
    if (!value.trim()) return { success: false, error: 'Title is required.' }
    changes.push({ field: 'title', oldValue: wo.title, newValue: value.trim() })
    patch.title = value.trim()
  } else if (field === 'description') {
    changes.push({ field: 'description', oldValue: wo.description, newValue: value })
    patch.description = value
  } else if (field === 'estimated_cost') {
    const n = parseFloat(value.replace(/[$,]/g, ''))
    if (Number.isNaN(n) || n < 0) return { success: false, error: 'Invalid estimate.' }
    changes.push({ field: 'estimated_cost', oldValue: str(wo.estimated_cost), newValue: String(n) })
    patch.estimated_cost = n
  }

  const { error } = await ctx.supabase.from('work_orders').update(patch).eq('id', projectId).eq('org_id', ctx.person.org_id)
  if (error) {
    console.error('[updateProjectField]', error)
    return { success: false, error: 'Failed to update project.' }
  }
  await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'work_orders', projectId, ctx.person.id, changes)
  revalidatePath('/app')
  return { success: true }
}

export async function archiveProperties(unitIds: string[]): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can archive properties.' }
  if (!unitIds.length) return { success: false, error: 'No properties selected.' }

  const uniqueIds = [...new Set(unitIds)]
  const { data: units } = await ctx.supabase
    .from('units')
    .select('id, archived_at')
    .eq('org_id', ctx.person.org_id)
    .in('id', uniqueIds)

  if (!units?.length) return { success: false, error: 'No matching properties found.' }

  const now = new Date().toISOString()
  const toArchive = units.filter((u) => !u.archived_at)
  if (!toArchive.length) return { success: true }

  const { error } = await ctx.supabase
    .from('units')
    .update({ archived_at: now, updated_at: now })
    .eq('org_id', ctx.person.org_id)
    .in('id', toArchive.map((u) => u.id))

  if (error) {
    console.error('[archiveProperties]', error)
    return { success: false, error: 'Failed to archive properties.' }
  }

  for (const unit of toArchive) {
    await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'units', unit.id, ctx.person.id, [
      { field: 'archived_at', oldValue: null, newValue: now },
    ])
  }

  revalidatePath('/app')
  return { success: true }
}

export async function unarchiveProperties(unitIds: string[]): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can restore properties.' }
  if (!unitIds.length) return { success: false, error: 'No properties selected.' }

  const uniqueIds = [...new Set(unitIds)]
  const { data: units } = await ctx.supabase
    .from('units')
    .select('id, archived_at')
    .eq('org_id', ctx.person.org_id)
    .in('id', uniqueIds)

  if (!units?.length) return { success: false, error: 'No matching properties found.' }

  const now = new Date().toISOString()
  const toRestore = units.filter((u) => u.archived_at)
  if (!toRestore.length) return { success: true }

  const { error } = await ctx.supabase
    .from('units')
    .update({ archived_at: null, updated_at: now })
    .eq('org_id', ctx.person.org_id)
    .in('id', toRestore.map((u) => u.id))

  if (error) {
    console.error('[unarchiveProperties]', error)
    return { success: false, error: 'Failed to restore properties.' }
  }

  for (const unit of toRestore) {
    await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'units', unit.id, ctx.person.id, [
      { field: 'archived_at', oldValue: unit.archived_at, newValue: null },
    ])
  }

  revalidatePath('/app')
  return { success: true }
}

type UnitWithProperty = {
  id: string
  property_id: string | null
  hospitable_property_id: string | null
  properties: { id: string; street_address: string; city: string } | null
}

async function loadOrgUnits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  unitIds: string[]
): Promise<UnitWithProperty[]> {
  const uniqueIds = [...new Set(unitIds)]
  const { data } = await supabase
    .from('units')
    .select('id, property_id, hospitable_property_id, properties!property_id(id, street_address, city)')
    .eq('org_id', orgId)
    .in('id', uniqueIds)
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return (data ?? []) as any[]
}

async function collectUnitDeleteBlockers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  unitIds: string[]
): Promise<Map<string, string[]>> {
  const blockers = new Map<string, string[]>()
  const add = (unitId: string, reason: string) => {
    if (!blockers.has(unitId)) blockers.set(unitId, [])
    blockers.get(unitId)!.push(reason)
  }

  const { data: activeLeases } = await supabase
    .from('leases')
    .select('unit_id')
    .eq('org_id', orgId)
    .in('unit_id', unitIds)
    .eq('status', 'active')
  for (const row of activeLeases ?? []) add(row.unit_id, 'active lease')

  const { data: allLeases } = await supabase
    .from('leases')
    .select('unit_id')
    .eq('org_id', orgId)
    .in('unit_id', unitIds)
  for (const row of allLeases ?? []) {
    if (!blockers.get(row.unit_id)?.includes('active lease')) {
      add(row.unit_id, 'lease history')
    }
  }

  const { data: unitWorkOrders } = await supabase
    .from('work_orders')
    .select('unit_id')
    .eq('org_id', orgId)
    .in('unit_id', unitIds)
  for (const row of unitWorkOrders ?? []) {
    if (row.unit_id) add(row.unit_id, 'linked work order')
  }

  return blockers
}

async function collectPropertyDeleteBlockers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  propertyIds: string[]
): Promise<Map<string, string[]>> {
  const blockers = new Map<string, string[]>()
  const add = (propertyId: string, reason: string) => {
    if (!blockers.has(propertyId)) blockers.set(propertyId, [])
    blockers.get(propertyId)!.push(reason)
  }

  const checks: { table: 'expenses' | 'owner_statements' | 'work_orders' | 'announcements'; reason: string }[] = [
    { table: 'expenses', reason: 'expenses' },
    { table: 'owner_statements', reason: 'owner statements' },
    { table: 'work_orders', reason: 'work orders' },
    { table: 'announcements', reason: 'announcements' },
  ]

  for (const { table, reason } of checks) {
    const { data } = await supabase
      .from(table)
      .select('property_id')
      .eq('org_id', orgId)
      .in('property_id', propertyIds)
    for (const row of data ?? []) add(row.property_id, reason)
  }

  return blockers
}

export async function deleteProperties(unitIds: string[]): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can delete properties.' }
  if (!unitIds.length) return { success: false, error: 'No properties selected.' }

  const units = await loadOrgUnits(ctx.supabase, ctx.person.org_id, unitIds)
  if (!units.length) return { success: false, error: 'No matching properties found.' }

  const unitBlockers = await collectUnitDeleteBlockers(ctx.supabase, ctx.person.org_id, units.map((u) => u.id))
  if (unitBlockers.size) {
    const lines = units
      .filter((u) => unitBlockers.has(u.id))
      .map((u) => {
        const addr = u.properties ? `${u.properties.street_address}, ${u.properties.city}` : u.id
        return `${addr}: ${unitBlockers.get(u.id)!.join(', ')}`
      })
    return {
      success: false,
      error: `Cannot delete — remove or merge blockers first.\n${lines.join('\n')}`,
    }
  }

  const propertyIds = [...new Set(units.map((u) => u.property_id).filter(Boolean) as string[])]
  const propertyBlockers = await collectPropertyDeleteBlockers(ctx.supabase, ctx.person.org_id, propertyIds)

  for (const unit of units) {
    const { error } = await ctx.supabase.from('units').delete().eq('id', unit.id).eq('org_id', ctx.person.org_id)
    if (error) {
      console.error('[deleteProperties] unit', error)
      return { success: false, error: `Failed to delete property at ${unit.properties?.street_address ?? unit.id}.` }
    }
    await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'units', unit.id, ctx.person.id, [
      { field: '_deleted', oldValue: unit.properties?.street_address ?? unit.id, newValue: null },
    ])
  }

  for (const propertyId of propertyIds) {
    const { count } = await ctx.supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('org_id', ctx.person.org_id)
    if ((count ?? 0) > 0) continue
    if (propertyBlockers.has(propertyId)) continue

    const { error } = await ctx.supabase
      .from('properties')
      .delete()
      .eq('id', propertyId)
      .eq('org_id', ctx.person.org_id)
    if (error) {
      console.error('[deleteProperties] property', error)
      continue
    }
    await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'properties', propertyId, ctx.person.id, [
      { field: '_deleted', oldValue: propertyId, newValue: null },
    ])
  }

  revalidatePath('/app')
  return { success: true }
}

export type MergePropertiesResult =
  | { success: true; warning?: string }
  | { success: false; error: string }

export async function mergeProperties(input: {
  primaryUnitId: string
  mergeUnitIds: string[]
}): Promise<MergePropertiesResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can merge properties.' }

  const mergeIds = [...new Set(input.mergeUnitIds)].filter((id) => id !== input.primaryUnitId)
  if (!mergeIds.length) return { success: false, error: 'Select at least one other property to merge.' }

  const allIds = [input.primaryUnitId, ...mergeIds]
  const units = await loadOrgUnits(ctx.supabase, ctx.person.org_id, allIds)
  if (units.length !== allIds.length) return { success: false, error: 'One or more properties were not found.' }

  const primary = units.find((u) => u.id === input.primaryUnitId)
  if (!primary?.properties || !primary.property_id) {
    return { success: false, error: 'Primary property is missing address data.' }
  }

  const mergeUnits = units.filter((u) => mergeIds.includes(u.id))
  const mismatched = mergeUnits.filter((u) => u.properties && !addressesMatch(primary.properties!, u.properties))
  const warning = mismatched.length
    ? `Warning: ${mismatched.length} propert${mismatched.length === 1 ? 'y has' : 'ies have'} a different address than the primary.`
    : undefined

  const primaryPropertyId = primary.property_id
  const absorbedPropertyIds = [...new Set(mergeUnits.map((u) => u.property_id).filter(Boolean) as string[])].filter(
    (id) => id !== primaryPropertyId
  )

  if (absorbedPropertyIds.length) {
    const { data: primaryPeriods } = await ctx.supabase
      .from('owner_statements')
      .select('period_year, period_month')
      .eq('org_id', ctx.person.org_id)
      .eq('property_id', primaryPropertyId)
    const periodSet = new Set((primaryPeriods ?? []).map((p) => `${p.period_year}-${p.period_month}`))

    for (const propertyId of absorbedPropertyIds) {
      const { data: mergePeriods } = await ctx.supabase
        .from('owner_statements')
        .select('period_year, period_month')
        .eq('org_id', ctx.person.org_id)
        .eq('property_id', propertyId)
      for (const p of mergePeriods ?? []) {
        if (periodSet.has(`${p.period_year}-${p.period_month}`)) {
          return {
            success: false,
            error: `Cannot merge — both properties have owner statements for ${p.period_year}-${String(p.period_month).padStart(2, '0')}.`,
          }
        }
      }
    }
  }

  const { data: primaryListing } = await ctx.supabase
    .from('listings')
    .select('id')
    .eq('org_id', ctx.person.org_id)
    .eq('unit_id', primary.id)
    .maybeSingle()

  let primaryHasListing = !!primaryListing

  for (const mergeUnit of mergeUnits) {
    const mergeUnitId = mergeUnit.id
    const mergePropertyId = mergeUnit.property_id

    await ctx.supabase
      .from('leases')
      .update({ unit_id: primary.id, updated_at: new Date().toISOString() })
      .eq('org_id', ctx.person.org_id)
      .eq('unit_id', mergeUnitId)

    const { data: mergeListing } = await ctx.supabase
      .from('listings')
      .select('id')
      .eq('org_id', ctx.person.org_id)
      .eq('unit_id', mergeUnitId)
      .maybeSingle()

    if (mergeListing) {
      if (primaryHasListing) {
        await ctx.supabase.from('listings').delete().eq('id', mergeListing.id).eq('org_id', ctx.person.org_id)
      } else {
        await ctx.supabase
          .from('listings')
          .update({ unit_id: primary.id, updated_at: new Date().toISOString() })
          .eq('id', mergeListing.id)
          .eq('org_id', ctx.person.org_id)
        primaryHasListing = true
      }
    }

    if (mergePropertyId && mergePropertyId !== primaryPropertyId) {
      await ctx.supabase
        .from('work_orders')
        .update({
          property_id: primaryPropertyId,
          unit_id: primary.id,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', ctx.person.org_id)
        .eq('property_id', mergePropertyId)
    } else {
      await ctx.supabase
        .from('work_orders')
        .update({ unit_id: primary.id, updated_at: new Date().toISOString() })
        .eq('org_id', ctx.person.org_id)
        .eq('unit_id', mergeUnitId)
    }

    if (mergePropertyId && mergePropertyId !== primaryPropertyId) {
      for (const table of ['expenses', 'announcements', 'chat_threads'] as const) {
        await ctx.supabase
          .from(table)
          .update({ property_id: primaryPropertyId })
          .eq('org_id', ctx.person.org_id)
          .eq('property_id', mergePropertyId)
      }
      await ctx.supabase
        .from('owner_statements')
        .update({ property_id: primaryPropertyId })
        .eq('org_id', ctx.person.org_id)
        .eq('property_id', mergePropertyId)
    }

    if (!primary.hospitable_property_id && mergeUnit.hospitable_property_id) {
      await ctx.supabase
        .from('units')
        .update({
          hospitable_property_id: mergeUnit.hospitable_property_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', primary.id)
        .eq('org_id', ctx.person.org_id)
      primary.hospitable_property_id = mergeUnit.hospitable_property_id
    }

    const { error: delErr } = await ctx.supabase
      .from('units')
      .delete()
      .eq('id', mergeUnitId)
      .eq('org_id', ctx.person.org_id)
    if (delErr) {
      console.error('[mergeProperties] delete unit', delErr)
      return { success: false, error: `Failed to remove merged property ${mergeUnit.properties?.street_address ?? mergeUnitId}.` }
    }

    await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'units', mergeUnitId, ctx.person.id, [
      {
        field: 'merged_into',
        oldValue: mergeUnit.properties ? formatPropertyAddress(mergeUnit.properties) : mergeUnitId,
        newValue: formatPropertyAddress(primary.properties),
      },
    ])
  }

  for (const propertyId of absorbedPropertyIds) {
    const { count } = await ctx.supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('org_id', ctx.person.org_id)
    if ((count ?? 0) > 0) continue

    await ctx.supabase.from('properties').delete().eq('id', propertyId).eq('org_id', ctx.person.org_id)
    await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'properties', propertyId, ctx.person.id, [
      { field: 'merged_into', oldValue: propertyId, newValue: primaryPropertyId },
    ])
  }

  await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'units', primary.id, ctx.person.id, [
    {
      field: 'merged_from',
      oldValue: null,
      newValue: mergeUnits
        .map((u) => (u.properties ? formatPropertyAddress(u.properties) : u.id))
        .join('; '),
    },
  ])

  revalidatePath('/app')
  return warning ? { success: true, warning } : { success: true }
}