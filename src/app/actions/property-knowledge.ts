'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { listingBriefSchema, parseListingBrief, type ListingBrief } from '@/lib/listings/listing-brief'

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
}> {
  const ctx = await getStaff()
  if (!ctx) return { markdown: '', listingBrief: parseListingBrief({}) }

  const { data: prop } = await ctx.supabase
    .from('properties')
    .select('listing_brief')
    .eq('id', propertyId)
    .eq('org_id', ctx.person.org_id)
    .maybeSingle()

  const { data: kb } = await ctx.supabase
    .from('property_knowledge_base')
    .select('markdown')
    .eq('property_id', propertyId)
    .eq('org_id', ctx.person.org_id)
    .maybeSingle()

  return {
    markdown: kb?.markdown ?? '',
    listingBrief: parseListingBrief(prop?.listing_brief),
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
): Promise<ActionResult> {
  const ctx = await getStaff()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  const parsed = listingBriefSchema.safeParse(brief)
  if (!parsed.success) return { success: false, error: 'Invalid listing fields.' }

  const { error } = await ctx.supabase
    .from('properties')
    .update({
      listing_brief: parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', propertyId)
    .eq('org_id', ctx.person.org_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/app')
  return { success: true }
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
