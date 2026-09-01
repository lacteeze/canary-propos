'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  defaultOwnerPortfolioName,
  isOnboardingComplete,
  type OnboardingPath,
  type OnboardingStep,
} from '@/lib/canary/property-onboarding'
import { updatePropertyDetails, type PropertyDetailsInput } from '@/app/actions/entity-updates'
import { savePropertyListingBrief } from '@/app/actions/property-knowledge'
import type { ListingBrief } from '@/lib/listings/listing-brief'

type ActionResult = {
  success: true
  id?: string
  portfolioId?: string
  completed?: boolean
} | { success: false; error: string }

async function getManagerContext() {
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

function splitPersonName(name: string): { first: string | null; last: string | null } {
  const trimmed = name.trim()
  if (!trimmed) return { first: null, last: null }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { first: parts[0] ?? null, last: null }
  return { first: parts[0] ?? null, last: parts.slice(1).join(' ') }
}

async function recomputeCompletion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  propertyId: string,
): Promise<boolean> {
  const { data: row } = await supabase
    .from('property_onboarding')
    .select('path, details_completed_at, completed_at')
    .eq('property_id', propertyId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (!row || row.completed_at) return Boolean(row?.completed_at)

  const { data: prop } = await supabase
    .from('properties')
    .select('owner_id')
    .eq('id', propertyId)
    .eq('org_id', orgId)
    .maybeSingle()

  const { count: photoCount } = await supabase
    .from('property_media')
    .select('*', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .eq('org_id', orgId)
    .eq('visibility', 'listing')

  const { data: units } = await supabase
    .from('units')
    .select('id, archived_at')
    .eq('property_id', propertyId)
    .eq('org_id', orgId)
  const unitIds = (units ?? []).map((u) => u.id)
  const archived = (units ?? []).every((u) => u.archived_at)

  let hasListing = false
  let hasLease = false
  let hasTenant = false
  if (unitIds.length) {
    const [{ data: listings }, { data: leases }] = await Promise.all([
      supabase.from('listings').select('id').eq('org_id', orgId).in('unit_id', unitIds).limit(1),
      supabase.from('leases').select('id, tenant_id').eq('org_id', orgId).in('unit_id', unitIds).limit(8),
    ])
    hasListing = (listings ?? []).length > 0
    hasLease = (leases ?? []).length > 0
    hasTenant = (leases ?? []).some((l) => Boolean(l.tenant_id))
  }

  const complete = isOnboardingComplete({
    path: row.path === 'vacant' || row.path === 'occupied' ? row.path : null,
    detailsCompletedAt: row.details_completed_at,
    ownerId: prop?.owner_id ?? null,
    listingPhotoCount: photoCount ?? 0,
    hasListing,
    hasLease,
    hasTenant,
    archivedAt: archived ? 'archived' : null,
  })

  if (complete) {
    await supabase
      .from('property_onboarding')
      .update({ completed_at: new Date().toISOString() })
      .eq('property_id', propertyId)
      .eq('org_id', orgId)
  }
  return complete
}

export async function recomputeOnboardingCompletion(propertyId: string): Promise<ActionResult> {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false, error: 'Only managers can update property setup.' }
  const completed = await recomputeCompletion(ctx.supabase, ctx.person.org_id, propertyId)
  revalidatePath('/app')
  return { success: true, completed }
}

export async function saveOnboardingPath(
  propertyId: string,
  path: OnboardingPath,
  confirmed = false,
): Promise<ActionResult> {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false, error: 'Only managers can update property setup.' }
  if (path !== 'vacant' && path !== 'occupied') {
    return { success: false, error: 'Choose vacant or occupied.' }
  }

  const { data: units } = await ctx.supabase
    .from('units')
    .select('id')
    .eq('property_id', propertyId)
    .eq('org_id', ctx.person.org_id)
  const unitIds = (units ?? []).map((u) => u.id)
  let hasListing = false
  let hasLease = false
  if (unitIds.length) {
    const [{ count: listingCount }, { count: leaseCount }] = await Promise.all([
      ctx.supabase.from('listings').select('*', { count: 'exact', head: true }).eq('org_id', ctx.person.org_id).in('unit_id', unitIds),
      ctx.supabase.from('leases').select('*', { count: 'exact', head: true }).eq('org_id', ctx.person.org_id).in('unit_id', unitIds),
    ])
    hasListing = (listingCount ?? 0) > 0
    hasLease = (leaseCount ?? 0) > 0
  }
  if ((hasListing || hasLease) && !confirmed) {
    return { success: false, error: 'Confirm to switch path after a listing or lease exists.' }
  }

  const { error: ensureError } = await ctx.supabase.from('property_onboarding').upsert(
    {
      org_id: ctx.person.org_id,
      property_id: propertyId,
      current_step: 'path',
      created_by: ctx.person.id,
    },
    { onConflict: 'property_id', ignoreDuplicates: true },
  )
  if (ensureError) {
    console.error('[saveOnboardingPath:ensure]', ensureError)
  }

  const nextStep: OnboardingStep = 'details'
  const { error } = await ctx.supabase
    .from('property_onboarding')
    .update({ path, current_step: nextStep })
    .eq('property_id', propertyId)
    .eq('org_id', ctx.person.org_id)
  if (error) {
    console.error('[saveOnboardingPath]', error)
    return { success: false, error: 'Failed to save path.' }
  }
  const completed = await recomputeCompletion(ctx.supabase, ctx.person.org_id, propertyId)
  revalidatePath('/app')
  return { success: true, completed }
}

export async function saveOnboardingStep(
  propertyId: string,
  step: OnboardingStep,
): Promise<ActionResult> {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false, error: 'Only managers can update property setup.' }
  const allowed: OnboardingStep[] = ['path', 'details', 'photos', 'listing', 'lease']
  if (!allowed.includes(step)) return { success: false, error: 'Invalid step.' }
  const { error } = await ctx.supabase
    .from('property_onboarding')
    .update({ current_step: step })
    .eq('property_id', propertyId)
    .eq('org_id', ctx.person.org_id)
  if (error) {
    console.error('[saveOnboardingStep]', error)
    return { success: false, error: 'Failed to save progress.' }
  }
  revalidatePath('/app')
  return { success: true }
}

const detailsSchema = z.object({
  propertyId: z.string().uuid(),
  unitId: z.string().uuid(),
  details: z.custom<PropertyDetailsInput>(),
  brief: z.custom<ListingBrief>(),
})

export async function saveOnboardingDetails(input: {
  propertyId: string
  unitId: string
  details: PropertyDetailsInput
  brief: ListingBrief
}): Promise<ActionResult> {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false, error: 'Only managers can update property setup.' }
  const parsed = detailsSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid details.' }

  const details = { ...parsed.data.details }
  if (details.ownerId && !details.portfolioId) {
    const { data: owner } = await ctx.supabase
      .from('people')
      .select('first_name, last_name, email')
      .eq('id', details.ownerId)
      .eq('org_id', ctx.person.org_id)
      .maybeSingle()
    const ownerName = [owner?.first_name, owner?.last_name].filter(Boolean).join(' ').trim() || owner?.email || 'New portfolio'
    const ensured = await ensureOwnerPortfolio(ctx.supabase, ctx.person.org_id, details.ownerId, ownerName)
    if (ensured.success) details.portfolioId = ensured.id
  }

  const detailsRes = await updatePropertyDetails(parsed.data.unitId, details)
  if (!detailsRes.success) return detailsRes
  const briefRes = await savePropertyListingBrief(parsed.data.propertyId, parsed.data.brief)
  if (!briefRes.success) return { success: false, error: briefRes.error }

  const { error } = await ctx.supabase
    .from('property_onboarding')
    .update({
      details_completed_at: new Date().toISOString(),
      current_step: 'photos',
    })
    .eq('property_id', parsed.data.propertyId)
    .eq('org_id', ctx.person.org_id)
  if (error) {
    console.error('[saveOnboardingDetails]', error)
    return { success: false, error: 'Details saved but progress was not recorded.' }
  }
  const completed = await recomputeCompletion(ctx.supabase, ctx.person.org_id, parsed.data.propertyId)
  revalidatePath('/app')
  return { success: true, completed }
}

export async function createOnboardingContact(input: {
  role: 'owner' | 'tenant'
  name: string
  email: string
  phone?: string
  propertyId?: string
}): Promise<ActionResult> {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false, error: 'Only managers can add people.' }
  const parsed = z
    .object({
      role: z.enum(['owner', 'tenant']),
      name: z.string().trim().min(1, 'Name is required'),
      email: z.string().trim().email('Valid email is required'),
      phone: z.string().optional(),
      propertyId: z.string().uuid().optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }

  const email = parsed.data.email.toLowerCase()
  const { data: existing } = await ctx.supabase
    .from('people')
    .select('id, role, first_name, last_name')
    .eq('org_id', ctx.person.org_id)
    .eq('email', email)
    .maybeSingle()

  let personId: string
  let displayName = parsed.data.name.trim()

  if (existing) {
    const roles = (existing.role as unknown as string[]) ?? []
    if (!roles.includes(parsed.data.role)) {
      const { error } = await ctx.supabase
        .from('people')
        .update({ role: [...roles, parsed.data.role], updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('org_id', ctx.person.org_id)
      if (error) {
        console.error('[createOnboardingContact] role', error)
        return { success: false, error: 'A person with this email exists. Pick them from the list.' }
      }
    }
    personId = existing.id
    displayName =
      [existing.first_name, existing.last_name].filter(Boolean).join(' ').trim() || displayName
  } else {
    const { first, last } = splitPersonName(parsed.data.name)
    const { data: created, error } = await ctx.supabase
      .from('people')
      .insert({
        org_id: ctx.person.org_id,
        email,
        first_name: first,
        last_name: last,
        phone: parsed.data.phone?.trim() || null,
        role: [parsed.data.role],
        active: true,
        status: 'Active',
      })
      .select('id')
      .single()
    if (error || !created) {
      console.error('[createOnboardingContact]', error)
      return { success: false, error: 'Failed to create contact.' }
    }
    personId = created.id
  }

  let portfolioId: string | undefined
  if (parsed.data.role === 'owner') {
    const ensured = await ensureOwnerPortfolio(ctx.supabase, ctx.person.org_id, personId, displayName)
    if (!ensured.success) return ensured
    portfolioId = ensured.id
  }

  if (parsed.data.propertyId && parsed.data.role === 'owner') {
    const patch: { owner_id: string; portfolio_id?: string; updated_at: string } = {
      owner_id: personId,
      updated_at: new Date().toISOString(),
    }
    if (portfolioId) patch.portfolio_id = portfolioId
    const { error } = await ctx.supabase
      .from('properties')
      .update(patch)
      .eq('id', parsed.data.propertyId)
      .eq('org_id', ctx.person.org_id)
    if (error) {
      console.error('[createOnboardingContact] property', error)
      return { success: false, error: 'Owner saved, but the property was not linked. Select them from the list.' }
    }
  }

  revalidatePath('/app')
  return { success: true, id: personId, portfolioId }
}

async function ensureOwnerPortfolio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  ownerId: string,
  ownerName: string,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const { data: existing } = await supabase
    .from('portfolios')
    .select('id')
    .eq('org_id', orgId)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (existing?.id) return { success: true, id: existing.id }

  const name = defaultOwnerPortfolioName(ownerName)
  const { data: byName } = await supabase
    .from('portfolios')
    .select('id, owner_id')
    .eq('org_id', orgId)
    .eq('name', name)
    .maybeSingle()
  if (byName?.id) {
    if (!byName.owner_id) {
      await supabase
        .from('portfolios')
        .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
        .eq('id', byName.id)
        .eq('org_id', orgId)
    }
    return { success: true, id: byName.id }
  }

  const { data: created, error } = await supabase
    .from('portfolios')
    .insert({ org_id: orgId, name, owner_id: ownerId })
    .select('id')
    .single()
  if (error || !created) {
    console.error('[ensureOwnerPortfolio]', error)
    return { success: false, error: 'Owner saved, but a portfolio could not be created.' }
  }
  return { success: true, id: created.id }
}
