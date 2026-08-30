'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { allocateListingSlugPreferProperty } from '@/lib/listings/slugify'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type ListingUpdate = Database['public']['Tables']['listings']['Update']

async function propertyContextForUnit(
  supabase: SupabaseClient,
  unitId: string,
  orgId: string,
): Promise<{ street: string | null; propertyId: string | null; propertySlug: string | null }> {
  const { data } = await supabase
    .from('units')
    .select('id, property_id, properties!property_id(id, street_address, slug)')
    .eq('id', unitId)
    .eq('org_id', orgId)
    .single()
  if (!data) return { street: null, propertyId: null, propertySlug: null }
  const prop = data.properties as
    | { id?: string; street_address?: string; slug?: string | null }
    | { id?: string; street_address?: string; slug?: string | null }[]
    | null
  const row = Array.isArray(prop) ? prop[0] : prop
  return {
    street: row?.street_address ?? null,
    propertyId: row?.id ?? data.property_id ?? null,
    propertySlug: row?.slug ?? null,
  }
}

async function ensurePropertySlugMatchesListing(opts: {
  supabase: SupabaseClient
  orgId: string
  propertyId: string | null
  propertySlug: string | null
  listingSlug: string
}) {
  if (!opts.propertyId || opts.propertySlug) return
  await opts.supabase
    .from('properties')
    .update({ slug: opts.listingSlug, updated_at: new Date().toISOString() })
    .eq('id', opts.propertyId)
    .eq('org_id', opts.orgId)
    .is('slug', null)
}

async function slugForPublish(opts: {
  supabase: SupabaseClient
  orgId: string
  unitId: string
  excludeListingId?: string
  existingSlug?: string | null
  unitChanged?: boolean
}): Promise<string | null> {
  if (opts.existingSlug && !opts.unitChanged) {
    return opts.existingSlug
  }
  const ctx = await propertyContextForUnit(opts.supabase, opts.unitId, opts.orgId)
  if (!ctx.street) return opts.existingSlug ?? null
  const slug = await allocateListingSlugPreferProperty({
    supabase: opts.supabase,
    orgId: opts.orgId,
    streetAddress: ctx.street,
    propertySlug: ctx.propertySlug,
    excludeListingId: opts.excludeListingId,
  })
  await ensurePropertySlugMatchesListing({
    supabase: opts.supabase,
    orgId: opts.orgId,
    propertyId: ctx.propertyId,
    propertySlug: ctx.propertySlug,
    listingSlug: slug,
  })
  return slug
}

// --- Types ---
export type ActionResult =
  | { success: true }
  | { success: false; error: string }

// --- Helper: resolve caller context ---
async function getCallerContext() {
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
  return { supabase, user, person }
}

// --- Schema ---
const listingStatusEnum = z.enum(['draft', 'published', 'unlisted', 'renewal_sent', 'declined'])

const listingSchema = z.object({
  unit_id: z.string().uuid('Unit is required'),
  listing_title: z.string().min(1, 'Title is required'),
  listing_description: z.string().optional().nullable(),
  highlights: z.array(z.string()).default([]),
  display_rent: z.coerce.number().positive().optional().nullable(),
  available_from: z.string().optional().nullable(),
  status: listingStatusEnum.default('draft'),
})

// --- createListing ---
export async function createListing(data: {
  unit_id: string
  listing_title: string
  listing_description?: string | null
  highlights?: string[]
  display_rent?: number | null
  available_from?: string | null
  status?: string
  property_id: string
}): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can create listings.' }
  }

  const parsed = listingSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  // T-03-09: verify the unit belongs to this org before inserting
  const { data: unit, error: unitError } = await ctx.supabase
    .from('units')
    .select('id')
    .eq('id', parsed.data.unit_id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (unitError || !unit) {
    return { success: false, error: 'Unit not found or does not belong to your organization.' }
  }

  let slug: string | null = null
  if (parsed.data.status === 'published') {
    slug = await slugForPublish({
      supabase: ctx.supabase,
      orgId: ctx.person.org_id,
      unitId: parsed.data.unit_id,
    })
  }

  // T-03-07: org_id comes from authenticated user, never from form data
  const { error } = await ctx.supabase.from('listings').insert({
    org_id: ctx.person.org_id,
    unit_id: parsed.data.unit_id,
    listing_title: parsed.data.listing_title,
    listing_description: parsed.data.listing_description ?? null,
    highlights: parsed.data.highlights.length > 0 ? parsed.data.highlights : null,
    display_rent: parsed.data.display_rent ?? null,
    available_from: parsed.data.available_from ?? null,
    status: parsed.data.status,
    slug,
  })

  if (error) {
    console.error('[createListing]', error)
    return { success: false, error: 'Failed to create listing. Please try again.' }
  }

  revalidatePath('/properties/' + data.property_id)
  return { success: true }
}

// --- updateListing ---
export async function updateListing(
  id: string,
  data: {
    unit_id: string
    listing_title: string
    listing_description?: string | null
    highlights?: string[]
    display_rent?: number | null
    available_from?: string | null
    status?: string
    property_id: string
  }
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can update listings.' }
  }

  const parsed = listingSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  // T-03-08: org_id guard on update
  const { data: existing, error: fetchError } = await ctx.supabase
    .from('listings')
    .select('id, slug, unit_id, listing_title, listing_description, display_rent, available_from, highlights, status, published_at')
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Listing not found.' }
  }

  // T-03-09: verify the unit belongs to this org
  const { data: unit, error: unitError } = await ctx.supabase
    .from('units')
    .select('id')
    .eq('id', parsed.data.unit_id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (unitError || !unit) {
    return { success: false, error: 'Unit not found or does not belong to your organization.' }
  }

  const unitChanged = existing.unit_id !== parsed.data.unit_id
  const updatePayload: ListingUpdate = {
    unit_id: parsed.data.unit_id,
    listing_title: parsed.data.listing_title,
    listing_description: parsed.data.listing_description ?? null,
    highlights: parsed.data.highlights.length > 0 ? parsed.data.highlights : null,
    display_rent: parsed.data.display_rent ?? null,
    available_from: parsed.data.available_from ?? null,
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.status === 'published') {
    updatePayload.published_at = existing.published_at ?? new Date().toISOString()
  }

  if (parsed.data.status === 'published') {
    const slug = await slugForPublish({
      supabase: ctx.supabase,
      orgId: ctx.person.org_id,
      unitId: parsed.data.unit_id,
      excludeListingId: id,
      existingSlug: existing.slug,
      unitChanged: unitChanged || !existing.slug,
    })
    if (slug) updatePayload.slug = slug
  }

  const { error } = await ctx.supabase
    .from('listings')
    .update(updatePayload)
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)

  if (error) {
    console.error('[updateListing]', error)
    return { success: false, error: 'Failed to update listing. Please try again.' }
  }

  revalidatePath('/properties/' + data.property_id)
  return { success: true }
}

// --- toggleListingStatus ---
export async function toggleListingStatus(
  id: string,
  newStatus: 'draft' | 'published' | 'unlisted',
  propertyId: string
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can change listing status.' }
  }

  const parsedStatus = listingStatusEnum.safeParse(newStatus)
  if (!parsedStatus.success) {
    return { success: false, error: 'Invalid status.' }
  }

  const { data: existing, error: fetchError } = await ctx.supabase
    .from('listings')
    .select('id, slug, unit_id, status, published_at')
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Listing not found.' }
  }

  const updatePayload: ListingUpdate = {
    status: parsedStatus.data,
    updated_at: new Date().toISOString(),
  }
  if (parsedStatus.data === 'published') {
    updatePayload.published_at = existing.published_at ?? new Date().toISOString()
  }

  if (parsedStatus.data === 'published' && !existing.slug) {
    const slug = await slugForPublish({
      supabase: ctx.supabase,
      orgId: ctx.person.org_id,
      unitId: existing.unit_id,
      excludeListingId: id,
    })
    if (slug) updatePayload.slug = slug
  }

  // T-03-08: org_id guard
  const { error } = await ctx.supabase
    .from('listings')
    .update(updatePayload)
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)

  if (error) {
    console.error('[toggleListingStatus]', error)
    return { success: false, error: 'Failed to update listing status. Please try again.' }
  }

  revalidatePath('/properties/' + propertyId)
  return { success: true }
}
