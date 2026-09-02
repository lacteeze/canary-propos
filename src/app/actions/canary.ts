'use server'

// Server actions backing the CanaryApp UI (draft lease composer + payment entry).
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { normalizeLeaseTermType, validateLeaseDates } from '@/lib/canary/lease-term'
import type { LeaseTermType } from '@/lib/canary/lease-term'
import { allocateListingSlugPreferProperty } from '@/lib/listings/slugify'
import { withListingTermHighlight, type ListingTermType } from '@/lib/landing/listing-term'
import type { Database } from '@/types/supabase'
import {
  DEFAULT_EXPENSE_RATES,
  snapshotExpenseBilling,
  type OrgRates,
} from '@/lib/billing/expense-breakdown'

type ActionResult = { success: true; id?: string } | { success: false; error: string }
type ListingUpsert = Database['public']['Tables']['listings']['Insert']

function listingSaveError(error: { message?: string } | null | undefined): string {
  const msg = error?.message || ''
  if (msg.includes('listing_status')) {
    return 'Could not save — run database migrations 0030_listing_status_renewal_sent and 0060_listing_status_declined.'
  }
  if (msg.includes('rental_credit')) {
    return 'Could not save — run database migration 0059_listings_rental_credit.'
  }
  if (msg.includes('available_until')) {
    return 'Could not save lease end — run database migration 0063_listings_available_until.'
  }
  return msg || 'Failed to save the draft listing.'
}

function revalidateListingSurfaces(opts: { listingId?: string | null; slug?: string | null }) {
  revalidatePath('/app')
  if (opts.listingId) {
    revalidatePath(`/app/listings/${opts.listingId}`)
    revalidatePath(`/listings/${opts.listingId}`)
  }
  if (opts.slug) revalidatePath(`/${opts.slug}`)
}

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

const draftListingStatusSchema = z.enum(['draft', 'renewal_sent', 'published', 'declined'])

const draftSchema = z.object({
  id: z.string().optional().nullable(),
  unitId: z.string().uuid('Property is required'),
  rent: z.coerce.number().positive().optional().nullable(),
  rentalCredit: z.coerce.number().min(0).optional().nullable(),
  rentalCreditExpiry: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()])
    .optional()
    .nullable(),
  start: z.string().optional().nullable(),
  end: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()])
    .optional()
    .nullable(),
  description: z.string().optional().nullable(),
  pets: z.string().optional().nullable(),
  utilities: z.string().optional().nullable(),
  status: draftListingStatusSchema.default('draft'),
  listingTerm: z.enum(['long', 'mid']).optional(),
})

export async function saveDraftListing(input: {
  id?: string | null
  unitId: string
  rent?: number | string | null
  rentalCredit?: number | string | null
  rentalCreditExpiry?: string | null
  start?: string | null
  end?: string | null
  description?: string | null
  pets?: string | null
  utilities?: string | null
  status: 'draft' | 'renewal_sent' | 'published' | 'declined'
  listingTerm?: ListingTermType
}): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can save draft listings.' }

  const parsed = draftSchema.safeParse({
    ...input,
    rent: input.rent === '' || input.rent == null ? null : input.rent,
    rentalCredit: input.rentalCredit === '' || input.rentalCredit == null ? null : input.rentalCredit,
    rentalCreditExpiry: input.rentalCreditExpiry?.trim() || null,
    end: input.end?.trim() || null,
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const d = parsed.data

  const { data: unit } = await ctx.supabase
    .from('units')
    .select('id, property_id, properties!property_id(id, street_address, city, slug)')
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

  let existing: {
    listing_title: string
    listing_description: string | null
    display_rent: number | null
    available_from: string | null
    available_until: string | null
    highlights: string[] | null
    status: string
    published_at: string | null
    slug: string | null
    unit_id: string
  } | null = null
  if (d.id) {
    const { data } = await ctx.supabase
      .from('listings')
      .select('listing_title, listing_description, display_rent, available_from, available_until, highlights, status, published_at, slug, unit_id')
      .eq('id', d.id)
      .eq('org_id', ctx.person.org_id)
      .maybeSingle()
    existing = data
  }

  const record: ListingUpsert = {
    org_id: ctx.person.org_id,
    unit_id: d.unitId,
    listing_title: title,
    listing_description: descriptionParts.join(' ') || null,
    display_rent: d.rent ?? null,
    available_from: d.start || null,
    available_until: d.end || null,
    status: d.status,
    updated_at: new Date().toISOString(),
  }
  if (d.listingTerm) {
    record.highlights = withListingTermHighlight(existing?.highlights, d.listingTerm)
  }
  if (Object.prototype.hasOwnProperty.call(input, 'rentalCredit')) {
    record.rental_credit = d.rentalCredit && d.rentalCredit > 0 ? d.rentalCredit : null
    record.rental_credit_expiry = d.rentalCreditExpiry || null
  }
  if (d.status === 'published') {
    record.published_at = existing?.published_at ?? new Date().toISOString()
  }

  if (d.status === 'published') {
    const existingSlug = existing?.slug ?? null
    const existingUnitId = existing?.unit_id ?? null
    const unitChanged = existingUnitId != null && existingUnitId !== d.unitId
    if (existingSlug && !unitChanged) {
      record.slug = existingSlug
    } else {
      const street = (prop?.street_address as string | undefined) ?? title
      record.slug = await allocateListingSlugPreferProperty({
        supabase: ctx.supabase,
        orgId: ctx.person.org_id,
        streetAddress: street,
        propertySlug: (prop?.slug as string | null | undefined) ?? null,
        excludeListingId: d.id ?? undefined,
      })
      const propertyId = (prop?.id as string | undefined) ?? unit.property_id
      if (propertyId && !prop?.slug && record.slug) {
        await ctx.supabase
          .from('properties')
          .update({ slug: record.slug, updated_at: new Date().toISOString() })
          .eq('id', propertyId)
          .eq('org_id', ctx.person.org_id)
          .is('slug', null)
      }
    }
  }

  if (d.id) {
    const { error } = await ctx.supabase
      .from('listings')
      .update(record)
      .eq('id', d.id)
      .eq('org_id', ctx.person.org_id)
    if (error) {
      console.error('[saveDraftListing:update]', error)
      return { success: false, error: listingSaveError(error) }
    }
    revalidateListingSurfaces({ listingId: d.id, slug: record.slug ?? existing?.slug })
    return { success: true, id: d.id }
  }

  // listings are unique per unit — upsert on unit_id
  const { data: inserted, error } = await ctx.supabase
    .from('listings')
    .upsert(record, { onConflict: 'unit_id' })
    .select('id, slug')
    .single()
  if (error) {
    console.error('[saveDraftListing:insert]', error)
    return { success: false, error: listingSaveError(error) }
  }
  revalidateListingSurfaces({ listingId: inserted?.id, slug: inserted?.slug ?? record.slug })
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
  rentalCredit: z.coerce.number().min(0).optional().nullable(),
  rentalCreditExpiry: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()])
    .optional()
    .nullable(),
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
  rentalCredit?: number | string | null
  rentalCreditExpiry?: string | null
  termType?: LeaseTermType
}): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers can activate draft leases.' }

  const parsed = activateDraftSchema.safeParse({
    ...input,
    tenantId: input.tenantId || null,
    monthlyRent: input.monthlyRent,
    rentalCredit: input.rentalCredit === '' || input.rentalCredit == null ? null : input.rentalCredit,
    rentalCreditExpiry: input.rentalCreditExpiry?.trim() || null,
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

  let rentalCredit = d.rentalCredit && d.rentalCredit > 0 ? d.rentalCredit : null
  let rentalCreditExpiry = d.rentalCreditExpiry || null

  if (d.listingId) {
    const { data: listing } = await ctx.supabase
      .from('listings')
      .select('id, unit_id, rental_credit, rental_credit_expiry')
      .eq('id', d.listingId)
      .eq('org_id', ctx.person.org_id)
      .single()
    if (!listing) return { success: false, error: 'Draft listing not found.' }
    if (listing.unit_id !== d.unitId) {
      return { success: false, error: 'Draft listing does not match the selected property.' }
    }
    if (rentalCredit == null && listing.rental_credit != null) {
      rentalCredit = Number(listing.rental_credit)
    }
    if (!rentalCreditExpiry && listing.rental_credit_expiry) {
      rentalCreditExpiry = listing.rental_credit_expiry
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
      rental_credit: rentalCredit,
      rental_credit_expiry: rentalCreditExpiry,
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

const paymentSchema = z
  .object({
    date: z.string().min(1, 'Date is required'),
    unitId: z.string().uuid('Property is required'),
    category: z.string().min(1),
    description: z.string().optional().nullable(),
    amount: z.coerce.number().min(0).optional(),
    suppliesCost: z.coerce.number().min(0).optional(),
    labourHours: z.coerce.number().min(0).optional(),
    type: z.enum(['Credit', 'Debit']),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'Credit' && !(val.amount && val.amount > 0)) {
      ctx.addIssue({ code: 'custom', message: 'Amount must be positive', path: ['amount'] })
    }
    if (val.type === 'Debit') {
      const supplies = val.suppliesCost ?? 0
      const hours = val.labourHours ?? 0
      if (supplies <= 0 && hours <= 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Enter supplies cost or labour hours.',
          path: ['suppliesCost'],
        })
      }
    }
  })

async function loadOrgExpenseRates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<OrgRates> {
  const { data } = await supabase
    .from('organizations')
    .select('expense_markup_rate, expense_labour_rate, expense_hst_rate')
    .eq('id', orgId)
    .single()
  return {
    markupRate: Number(data?.expense_markup_rate ?? DEFAULT_EXPENSE_RATES.markupRate),
    labourRate: Number(data?.expense_labour_rate ?? DEFAULT_EXPENSE_RATES.labourRate),
    hstRate: Number(data?.expense_hst_rate ?? DEFAULT_EXPENSE_RATES.hstRate),
  }
}

export async function savePaymentEntry(input: {
  date: string
  unitId: string
  category: string
  description?: string | null
  amount?: number | string
  suppliesCost?: number | string
  labourHours?: number | string
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
    const rates = await loadOrgExpenseRates(ctx.supabase, ctx.person.org_id)
    // computeExpenseBilling via snapshotExpenseBilling — supplies_cost + subtotal snapshotted; billed_amount is owner total
    const snapshot = snapshotExpenseBilling({
      suppliesCost: d.suppliesCost ?? 0,
      labourHours: d.labourHours ?? 0,
      rates,
      sourceChannel: 'manual',
    })
    const { error } = await ctx.supabase.from('expenses').insert({
      org_id: ctx.person.org_id,
      property_id: unit.property_id,
      description: [d.category, d.description].filter(Boolean).join(' — '),
      expense_date: d.date,
      created_by: ctx.person.id,
      ...snapshot,
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
  if (d.amount == null) {
    return { success: false, error: 'Amount must be positive' }
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
