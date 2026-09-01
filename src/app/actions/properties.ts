'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { defaultNewPropertyUnit } from '@/lib/canary/property-ops'
import { allocateUniquePropertySlug } from '@/lib/listings/slugify'
import { ensurePlanCapacityForImport, isPlanLimitExempt } from '@/lib/orgs/plan-limits'

// --- Types ---
export type ActionResult =
  | { success: true; propertyId?: string; unitId?: string }
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

// --- Schemas ---
const propertyTypeEnum = z.enum([
  'house',
  'duplex',
  'apartment_building',
  'condo',
  'townhouse',
  'other',
])

const propertySchema = z.object({
  street_address: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province is required'),
  postal_code: z.string().optional(),
  property_type: propertyTypeEnum,
  owner_id: z.string().uuid().optional().nullable(),
  portfolio_id: z.string().uuid().optional().nullable(),
  unit_number: z.string().optional().nullable(),
})

// --- createProperty ---
export async function createProperty(data: {
  street_address: string
  city: string
  province: string
  postal_code?: string
  property_type: string
  owner_id?: string | null
  portfolio_id?: string | null
  unit_number?: string | null
}): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can create properties.' }
  }

  const parsed = propertySchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  let slug: string
  try {
    slug = await allocateUniquePropertySlug({
      supabase: ctx.supabase,
      orgId: ctx.person.org_id,
      streetAddress: parsed.data.street_address,
    })
  } catch (err) {
    console.error('[createProperty:slug]', err)
    return { success: false, error: 'Failed to create property. Please try again.' }
  }

  const orgId = ctx.person.org_id

  const [{ data: org }, { count: unitCount }] = await Promise.all([
    ctx.supabase
      .from('organizations')
      .select('slug, plan_unit_limit')
      .eq('id', orgId)
      .single(),
    ctx.supabase
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId),
  ])

  if (org && unitCount !== null && unitCount >= org.plan_unit_limit) {
    if (isPlanLimitExempt(org)) {
      await ensurePlanCapacityForImport(ctx.supabase, orgId, 1)
    } else {
      return {
        success: false,
        error: 'You have reached your plan unit limit. Upgrade to add more units.',
      }
    }
  }

  const { data: created, error } = await ctx.supabase
    .from('properties')
    .insert({
      org_id: orgId,
      street_address: parsed.data.street_address,
      city: parsed.data.city,
      province: parsed.data.province,
      postal_code: parsed.data.postal_code ?? null,
      property_type: parsed.data.property_type,
      owner_id: parsed.data.owner_id ?? null,
      portfolio_id: parsed.data.portfolio_id ?? null,
      slug,
    })
    .select('id')
    .single()

  if (error || !created) {
    console.error('[createProperty]', error)
    return { success: false, error: 'Failed to create property. Please try again.' }
  }

  const { data: unit, error: unitError } = await ctx.supabase
    .from('units')
    .insert(defaultNewPropertyUnit(orgId, created.id, parsed.data.unit_number))
    .select('id')
    .single()

  if (unitError || !unit) {
    console.error('[createProperty:unit]', unitError)
    await ctx.supabase.from('properties').delete().eq('id', created.id).eq('org_id', orgId)
    if (unitError?.message?.includes('plan_unit_limit') || unitError?.code === 'P0001') {
      return {
        success: false,
        error: 'You have reached your plan unit limit. Upgrade to add more units.',
      }
    }
    return { success: false, error: 'Failed to create property. Please try again.' }
  }

  await ctx.supabase
    .from('property_onboarding')
    .update({ created_by: ctx.person.id })
    .eq('property_id', created.id)
    .eq('org_id', orgId)

  revalidatePath('/properties')
  revalidatePath('/app')
  return { success: true, propertyId: created.id, unitId: unit.id }
}

// --- updateProperty ---
export async function updateProperty(
  id: string,
  data: {
    street_address: string
    city: string
    province: string
    postal_code?: string
    property_type: string
    owner_id?: string | null
    portfolio_id?: string | null
  }
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can update properties.' }
  }

  const parsed = propertySchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  // Verify ownership (org scoping)
  const { data: existing, error: fetchError } = await ctx.supabase
    .from('properties')
    .select('id, slug')
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Property not found.' }
  }

  const patch: {
    street_address: string
    city: string
    province: string
    postal_code: string | null
    property_type: typeof parsed.data.property_type
    owner_id: string | null
    portfolio_id: string | null
    updated_at: string
    slug?: string
  } = {
    street_address: parsed.data.street_address,
    city: parsed.data.city,
    province: parsed.data.province,
    postal_code: parsed.data.postal_code ?? null,
    property_type: parsed.data.property_type,
    owner_id: parsed.data.owner_id ?? null,
    portfolio_id: parsed.data.portfolio_id ?? null,
    updated_at: new Date().toISOString(),
  }

  // Stable URL: only allocate when missing
  if (!existing.slug) {
    try {
      patch.slug = await allocateUniquePropertySlug({
        supabase: ctx.supabase,
        orgId: ctx.person.org_id,
        streetAddress: parsed.data.street_address,
        excludePropertyId: id,
      })
    } catch (err) {
      console.error('[updateProperty:slug]', err)
      return { success: false, error: 'Failed to update property. Please try again.' }
    }
  }

  const { error } = await ctx.supabase
    .from('properties')
    .update(patch)
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)

  if (error) {
    console.error('[updateProperty]', error)
    return { success: false, error: 'Failed to update property. Please try again.' }
  }

  revalidatePath('/properties')
  revalidatePath('/properties/' + id)
  revalidatePath('/app')
  return { success: true }
}
