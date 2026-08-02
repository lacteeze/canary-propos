'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  appendLearnedListingBriefOptions,
  collectNewListingBriefOptions,
  listingBriefSchema,
  mergeListingBriefOptions,
  parseListingBrief,
  petsLabelFromAmenities,
  syncPetsIntoAmenities,
  type ListingBrief,
  type ListingBriefOptions,
} from '@/lib/listings/listing-brief'

type ActionResult = { success: true } | { success: false; error: string }

async function getStaff() {
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
  if (!roles.includes('manager') && !roles.includes('admin') && !roles.includes('employee')) {
    return null
  }
  return { supabase, person }
}

export async function getPropertyKnowledge(propertyId: string): Promise<{
  markdown: string
  listingBrief: ListingBrief
  briefOptions: ListingBriefOptions
}> {
  const emptyOptions = mergeListingBriefOptions({})
  const ctx = await getStaff()
  if (!ctx) return { markdown: '', listingBrief: parseListingBrief({}), briefOptions: emptyOptions }

  const [{ data: prop }, { data: kb }, { data: optRow }, { data: units }] = await Promise.all([
    ctx.supabase
      .from('properties')
      .select('listing_brief')
      .eq('id', propertyId)
      .eq('org_id', ctx.person.org_id)
      .maybeSingle(),
    ctx.supabase
      .from('property_knowledge_base')
      .select('markdown')
      .eq('property_id', propertyId)
      .eq('org_id', ctx.person.org_id)
      .maybeSingle(),
    ctx.supabase
      .from('listing_brief_options')
      .select('options')
      .eq('org_id', ctx.person.org_id)
      .maybeSingle(),
    ctx.supabase
      .from('units')
      .select('amenities')
      .eq('property_id', propertyId)
      .eq('org_id', ctx.person.org_id)
      .limit(8),
  ])

  const brief = parseListingBrief(prop?.listing_brief)
  // Seed pets from legacy unit amenities when listing_brief.pets is empty.
  if (!brief.pets.trim()) {
    for (const u of units ?? []) {
      const fromAmenity = petsLabelFromAmenities(u.amenities as string[] | null)
      if (fromAmenity) {
        brief.pets = fromAmenity
        break
      }
    }
  }

  return {
    markdown: kb?.markdown ?? '',
    listingBrief: brief,
    briefOptions: mergeListingBriefOptions(optRow?.options),
  }
}

export async function savePropertyKnowledge(
  propertyId: string,
  markdown: string
): Promise<ActionResult> {
  const ctx = await getStaff()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  const text = markdown.slice(0, 100_000)
  const now = new Date().toISOString()

  const { data: existing } = await ctx.supabase
    .from('property_knowledge_base')
    .select('id')
    .eq('property_id', propertyId)
    .eq('org_id', ctx.person.org_id)
    .maybeSingle()

  if (existing) {
    const { error } = await ctx.supabase
      .from('property_knowledge_base')
      .update({ markdown: text, updated_by: ctx.person.id, updated_at: now })
      .eq('id', existing.id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await ctx.supabase.from('property_knowledge_base').insert({
      org_id: ctx.person.org_id,
      property_id: propertyId,
      markdown: text,
      updated_by: ctx.person.id,
      updated_at: now,
    })
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/app')
  return { success: true }
}

export async function savePropertyListingBrief(
  propertyId: string,
  brief: ListingBrief
): Promise<ActionResult & { briefOptions?: ListingBriefOptions }> {
  const ctx = await getStaff()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  const parsed = listingBriefSchema.safeParse(brief)
  if (!parsed.success) return { success: false, error: 'Invalid listing fields.' }

  const now = new Date().toISOString()

  const { error } = await ctx.supabase
    .from('properties')
    .update({
      listing_brief: parsed.data,
      updated_at: now,
    })
    .eq('id', propertyId)
    .eq('org_id', ctx.person.org_id)

  if (error) return { success: false, error: error.message }

  // Sync pets into unit amenities so public browse/cards stay consistent.
  const { data: units } = await ctx.supabase
    .from('units')
    .select('id, amenities')
    .eq('property_id', propertyId)
    .eq('org_id', ctx.person.org_id)

  for (const unit of units ?? []) {
    const nextAmenities = syncPetsIntoAmenities(unit.amenities as string[] | null, parsed.data.pets)
    const prev = ((unit.amenities as string[] | null) ?? []).join('\0')
    const next = nextAmenities.join('\0')
    if (prev === next) continue
    const { error: amenityErr } = await ctx.supabase
      .from('units')
      .update({ amenities: nextAmenities, updated_at: now })
      .eq('id', unit.id)
      .eq('org_id', ctx.person.org_id)
    if (amenityErr) return { success: false, error: amenityErr.message }
  }

  // Learn custom dropdown values org-wide.
  const { data: optRow } = await ctx.supabase
    .from('listing_brief_options')
    .select('options')
    .eq('org_id', ctx.person.org_id)
    .maybeSingle()

  const current = mergeListingBriefOptions(optRow?.options)
  const additions = collectNewListingBriefOptions(parsed.data, current)
  let briefOptions = current
  if (Object.keys(additions).length) {
    const nextStored = appendLearnedListingBriefOptions(optRow?.options, additions)
    if (optRow) {
      const { error: optErr } = await ctx.supabase
        .from('listing_brief_options')
        .update({ options: nextStored, updated_at: now })
        .eq('org_id', ctx.person.org_id)
      if (optErr) return { success: false, error: optErr.message }
    } else {
      const { error: optErr } = await ctx.supabase.from('listing_brief_options').insert({
        org_id: ctx.person.org_id,
        options: nextStored,
        updated_at: now,
      })
      if (optErr) return { success: false, error: optErr.message }
    }
    briefOptions = mergeListingBriefOptions(nextStored)
  }

  revalidatePath('/app')
  revalidatePath('/listings')
  return { success: true, briefOptions }
}

const leaseListingFieldsSchema = z.object({
  utilities_included: z.string().trim().max(300).nullable(),
  pets_policy: z.string().trim().max(200).nullable(),
  parking_spots: z.number().int().min(0).max(50).nullable(),
})

export async function updateLeaseListingFields(
  leaseId: string,
  fields: z.infer<typeof leaseListingFieldsSchema>
): Promise<ActionResult> {
  const ctx = await getStaff()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  const parsed = leaseListingFieldsSchema.safeParse(fields)
  if (!parsed.success) return { success: false, error: 'Invalid fields.' }

  const { error } = await ctx.supabase
    .from('leases')
    .update({
      utilities_included: parsed.data.utilities_included,
      pets_policy: parsed.data.pets_policy,
      parking_spots: parsed.data.parking_spots,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leaseId)
    .eq('org_id', ctx.person.org_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/app')
  return { success: true }
}
