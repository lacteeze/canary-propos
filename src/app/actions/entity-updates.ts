'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { str, writeAuditEntries } from '@/lib/canary/audit'
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
}

const UNIT_STATUS_REVERSE: Record<string, string> = {
  vacant: 'Vacant',
  occupied: 'Leased',
  maintenance: 'Maintenance',
}

export async function updatePropertyField(
  unitId: string,
  field: 'status' | 'asking_rent' | 'bedrooms' | 'bathrooms',
  value: string
): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can edit properties.' }

  const { data: unit } = await ctx.supabase
    .from('units')
    .select('id, status, asking_rent, bedrooms, bathrooms')
    .eq('id', unitId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!unit) return { success: false, error: 'Property not found.' }

  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = []
  const patch: UnitUpdate = { updated_at: new Date().toISOString() }

  if (field === 'status') {
    const dbVal = UNIT_STATUS_MAP[value] ?? value.toLowerCase()
    if (!['vacant', 'occupied', 'maintenance'].includes(dbVal)) {
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
  }

  const { error } = await ctx.supabase.from('units').update(patch).eq('id', unitId).eq('org_id', ctx.person.org_id)
  if (error) {
    console.error('[updatePropertyField]', error)
    return { success: false, error: 'Failed to update property.' }
  }
  await writeAuditEntries(ctx.supabase, ctx.person.org_id, 'units', unitId, ctx.person.id, changes)
  revalidatePath('/app')
  return { success: true }
}

const PET_LABELS = ['No pets', 'Pet friendly', 'Cat friendly', 'Dog friendly', 'By approval'] as const
const PET_AMENITY_RE = /pet|cat|dog|approval/i

const propertyDetailsSchema = z.object({
  status: z.enum(['Vacant', 'Leased', 'Maintenance']),
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
    .select('id, property_id, status, bedrooms, bathrooms, asking_rent, amenities')
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
  field: 'renewal_status' | 'monthly_rent' | 'deposit_amount' | 'start_date' | 'end_date' | 'status',
  value: string
): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can edit leases.' }

  const { data: lease } = await ctx.supabase
    .from('leases')
    .select('id, renewal_status, monthly_rent, deposit_amount, start_date, end_date, status')
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
  } else if (field === 'start_date' || field === 'end_date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { success: false, error: 'Invalid date format.' }
    changes.push({ field, oldValue: str(lease[field]), newValue: value })
    patch[field] = value
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