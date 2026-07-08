'use server'

// Server actions backing the CanaryApp UI (draft lease composer + payment entry).
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { normalizeLeaseTermType, validateLeaseDates } from '@/lib/canary/lease-term'
import type { LeaseTermType } from '@/lib/canary/lease-term'

type ActionResult = { success: true; id?: string } | { success: false; error: string }

async function getStaffContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  const roles = (person.role as unknown as string[]) ?? []
  if (!roles.includes('manager') && !roles.includes('admin')) return null
  return { supabase, person }
}

// ---------- Draft lease / listing ----------

const draftListingStatusSchema = z.enum(['draft', 'renewal_sent', 'published'])

const draftSchema = z.object({
  id: z.string().optional().nullable(),
  unitId: z.string().uuid('Property is required'),
  rent: z.coerce.number().positive().optional().nullable(),
  start: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  pets: z.string().optional().nullable(),
  utilities: z.string().optional().nullable(),
  status: draftListingStatusSchema.default('draft'),
})

export async function saveDraftListing(input: {
  id?: string | null
  unitId: string
  rent?: number | string | null
  start?: string | null
  description?: string | null
  pets?: string | null
  utilities?: string | null
  status: 'draft' | 'renewal_sent' | 'published'
}): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can save draft listings.' }

  const parsed = draftSchema.safeParse({
    ...input,
    rent: input.rent === '' || input.rent == null ? null : input.rent,
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const d = parsed.data

  const { data: unit } = await ctx.supabase
    .from('units')
    .select('id, properties!property_id(street_address, city)')
    .eq('id', d.unitId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!unit) return { success: false, error: 'Property not found in your organization.' }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const prop = (unit as any).properties
  const title = prop ? `${prop.street_address}${prop.city ? ', ' + prop.city : ''}` : 'Listing'

  const descriptionParts = [d.description?.trim()].filter(Boolean) as string[]
  if (d.pets && d.pets !== 'No pets' && !/pet/i.test(d.description ?? '')) {
    descriptionParts.push(`Pets: ${d.pets}.`)
  }
  if (d.utilities === 'Included' && !/utilit/i.test(d.description ?? '')) {
    descriptionParts.push('Utilities included.')
  }

  const record = {
    org_id: ctx.person.org_id,
    unit_id: d.unitId,
    listing_title: title,
    listing_description: descriptionParts.join(' ') || null,
    display_rent: d.rent ?? null,
    available_from: d.start || null,
    status: d.status,
    updated_at: new Date().toISOString(),
  }

  if (d.id) {
    const { error } = await ctx.supabase
      .from('listings')
      .update(record)
      .eq('id', d.id)
      .eq('org_id', ctx.person.org_id)
    if (error) {
      console.error('[saveDraftListing:update]', error)
      const msg = error.message?.includes('listing_status')
        ? 'Could not save — run database migration 0030_listing_status_renewal_sent (renewal_sent status).'
        : error.message || 'Failed to save the draft listing.'
      return { success: false, error: msg }
    }
    revalidatePath('/app')
    return { success: true, id: d.id }
  }

  // listings are unique per unit — upsert on unit_id
  const { data: inserted, error } = await ctx.supabase
    .from('listings')
    .upsert(record, { onConflict: 'unit_id' })
    .select('id')
    .single()
  if (error) {
    console.error('[saveDraftListing:insert]', error)
    const msg = error.message?.includes('listing_status')
      ? 'Could not save — run database migration 0030_listing_status_renewal_sent (renewal_sent status).'
      : error.message || 'Failed to save the draft listing.'
    return { success: false, error: msg }
  }
  revalidatePath('/app')
  return { success: true, id: inserted?.id }
}

const activateDraftSchema = z.object({
  listingId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid('Property is required'),
  tenantId: z.string().uuid().optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date is required'),
  endDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()])
    .optional()
    .nullable(),
  monthlyRent: z.coerce.number().positive('Monthly rent is required'),
  termType: z.enum(['fixed_term', 'month_to_month']).default('fixed_term'),
})

/** Promote a draft listing into an active lease row and unlist the draft. */
export async function activateDraftListing(input: {
  listingId?: string | null
  unitId: string
  tenantId?: string | null
  startDate: string
  endDate?: string | null
  monthlyRent: number | string
  termType?: LeaseTermType
}): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can activate draft leases.' }

  const parsed = activateDraftSchema.safeParse({
    ...input,
    tenantId: input.tenantId || null,
    monthlyRent: input.monthlyRent,
    endDate: input.endDate?.trim() || null,
    termType: normalizeLeaseTermType(input.termType),
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const d = parsed.data

  const dateErr = validateLeaseDates(d.termType, d.startDate, d.endDate || null)
  if (dateErr) return { success: false, error: dateErr }

  const { data: unit } = await ctx.supabase
    .from('units')
    .select('id')
    .eq('id', d.unitId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!unit) return { success: false, error: 'Property not found in your organization.' }

  if (d.tenantId) {
    const { data: tenant } = await ctx.supabase
      .from('people')
      .select('id')
      .eq('id', d.tenantId)
      .eq('org_id', ctx.person.org_id)
      .single()
    if (!tenant) return { success: false, error: 'Tenant not found in your organization.' }
  }

  if (d.listingId) {
    const { data: listing } = await ctx.supabase
      .from('listings')
      .select('id, unit_id')
      .eq('id', d.listingId)
      .eq('org_id', ctx.person.org_id)
      .single()
    if (!listing) return { success: false, error: 'Draft listing not found.' }
    if (listing.unit_id !== d.unitId) {
      return { success: false, error: 'Draft listing does not match the selected property.' }
    }
  }

  const { data: newLease, error: insertError } = await ctx.supabase
    .from('leases')
    .insert({
      org_id: ctx.person.org_id,
      unit_id: d.unitId,
      tenant_id: d.tenantId ?? null,
      start_date: d.startDate,
      end_date: d.endDate || null,
      lease_term_type: d.termType,
      monthly_rent: d.monthlyRent,
      deposit_amount: 0,
      rent_due_day: 1,
      status: 'active',
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[activateDraftListing:insert]', insertError)
    return { success: false, error: 'Failed to create the lease. Please try again.' }
  }

  if (d.listingId) {
    const { error: listingError } = await ctx.supabase
      .from('listings')
      .update({ status: 'unlisted', updated_at: new Date().toISOString() })
      .eq('id', d.listingId)
      .eq('org_id', ctx.person.org_id)
    if (listingError) {
      console.error('[activateDraftListing:unlist]', listingError)
      return { success: false, error: 'Lease created but failed to remove the draft listing.' }
    }
  }

  await ctx.supabase.from('units').update({ status: 'occupied' }).eq('id', d.unitId)

  revalidatePath('/app')
  revalidatePath('/leases')
  return { success: true, id: newLease.id }
}

export async function deleteDraftListing(id: string): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can delete draft listings.' }

  const { error } = await ctx.supabase
    .from('listings')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)
  if (error) {
    console.error('[deleteDraftListing]', error)
    return { success: false, error: 'Failed to delete the draft listing.' }
  }
  revalidatePath('/app')
  return { success: true }
}

// ---------- Payments / expenses ----------

const paymentSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  unitId: z.string().uuid('Property is required'),
  category: z.string().min(1),
  description: z.string().optional().nullable(),
  amount: z.coerce.number().positive('Amount must be positive'),
  type: z.enum(['Credit', 'Debit']),
})

export async function savePaymentEntry(input: {
  date: string
  unitId: string
  category: string
  description?: string | null
  amount: number | string
  type: 'Credit' | 'Debit'
}): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can record payments.' }

  const parsed = paymentSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const d = parsed.data

  const { data: unit } = await ctx.supabase
    .from('units')
    .select('id, property_id')
    .eq('id', d.unitId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!unit || !unit.property_id) {
    return { success: false, error: 'Property not found in your organization.' }
  }

  if (d.type === 'Debit') {
    // Money going out → record as a property expense
    const { error } = await ctx.supabase.from('expenses').insert({
      org_id: ctx.person.org_id,
      property_id: unit.property_id,
      description: [d.category, d.description].filter(Boolean).join(' — '),
      vendor_cost: d.amount,
      billed_amount: d.amount,
      expense_date: d.date,
      created_by: ctx.person.id,
    })
    if (error) {
      console.error('[savePaymentEntry:expense]', error)
      return { success: false, error: 'Failed to record the expense.' }
    }
    revalidatePath('/app')
    return { success: true }
  }

  // Credit → payment against the active lease on that unit
  const { data: lease } = await ctx.supabase
    .from('leases')
    .select('id')
    .eq('unit_id', d.unitId)
    .eq('status', 'active')
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!lease) {
    return { success: false, error: 'No active lease on that property — credits must attach to a lease.' }
  }

  const { error } = await ctx.supabase.from('payments').insert({
    org_id: ctx.person.org_id,
    lease_id: lease.id,
    amount: d.amount,
    method: 'bank_transfer',
    status: 'recorded',
    notes: [d.category, d.description].filter(Boolean).join(' — '),
    recorded_by: ctx.person.id,
  })
  if (error) {
    console.error('[savePaymentEntry:payment]', error)
    return { success: false, error: 'Failed to record the payment.' }
  }
  revalidatePath('/app')
  return { success: true }
}
