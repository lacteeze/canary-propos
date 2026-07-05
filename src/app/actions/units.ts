'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  return { supabase, user, person }
}

// --- Schema ---
const unitSchema = z.object({
  property_id: z.string().uuid('Invalid property ID'),
  unit_number: z.string().min(1, 'Unit number is required'),
  floor: z.number().int().optional().nullable(),
  bedrooms: z.number().int().min(0, 'Bedrooms must be 0 or more'),
  bathrooms: z.number().min(0.5, 'Bathrooms must be at least 0.5'),
  sq_footage: z.number().positive().optional().nullable(),
  status: z.enum(['vacant', 'occupied', 'maintenance']),
  asking_rent: z.number().positive().optional().nullable(),
  amenities: z.array(z.string()).optional().nullable(),
})

// --- createUnit ---
export async function createUnit(data: {
  property_id: string
  unit_number: string
  floor?: number | null
  bedrooms: number
  bathrooms: number
  sq_footage?: number | null
  status: string
  asking_rent?: number | null
  amenities?: string[] | null
}): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can add units.' }
  }

  const parsed = unitSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const orgId = ctx.person.org_id

  // Plan-limit pre-check: fetch org limit and current count
  const [{ data: org }, { count: unitCount }] = await Promise.all([
    ctx.supabase
      .from('organizations')
      .select('plan_unit_limit')
      .eq('id', orgId)
      .single(),
    ctx.supabase
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId),
  ])

  if (org && unitCount !== null && unitCount >= org.plan_unit_limit) {
    return {
      success: false,
      error: 'You have reached your plan unit limit. Upgrade to add more units.',
    }
  }

  // Verify property belongs to the org
  const { data: property, error: propError } = await ctx.supabase
    .from('properties')
    .select('id')
    .eq('id', parsed.data.property_id)
    .eq('org_id', orgId)
    .single()

  if (propError || !property) {
    return { success: false, error: 'Property not found.' }
  }

  const { error } = await ctx.supabase.from('units').insert({
    org_id: orgId,
    property_id: parsed.data.property_id,
    unit_number: parsed.data.unit_number,
    floor: parsed.data.floor ?? null,
    bedrooms: parsed.data.bedrooms,
    bathrooms: parsed.data.bathrooms,
    sq_footage: parsed.data.sq_footage ?? null,
    status: parsed.data.status,
    asking_rent: parsed.data.asking_rent ?? null,
    amenities: parsed.data.amenities ?? null,
  })

  if (error) {
    console.error('[createUnit]', error)
    // Check for trigger-enforced plan limit violation
    if (error.message?.includes('plan_unit_limit') || error.code === 'P0001') {
      return {
        success: false,
        error: 'You have reached your plan unit limit. Upgrade to add more units.',
      }
    }
    return { success: false, error: 'Failed to add unit. Please try again.' }
  }

  revalidatePath('/properties/' + parsed.data.property_id)
  return { success: true }
}

// --- updateUnit ---
export async function updateUnit(
  id: string,
  data: {
    property_id: string
    unit_number: string
    floor?: number | null
    bedrooms: number
    bathrooms: number
    sq_footage?: number | null
    status: string
    asking_rent?: number | null
    amenities?: string[] | null
  }
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can update units.' }
  }

  const parsed = unitSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  // Verify org ownership
  const { data: existing, error: fetchError } = await ctx.supabase
    .from('units')
    .select('id, property_id')
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Unit not found.' }
  }

  const { error } = await ctx.supabase
    .from('units')
    .update({
      unit_number: parsed.data.unit_number,
      floor: parsed.data.floor ?? null,
      bedrooms: parsed.data.bedrooms,
      bathrooms: parsed.data.bathrooms,
      sq_footage: parsed.data.sq_footage ?? null,
      status: parsed.data.status,
      asking_rent: parsed.data.asking_rent ?? null,
      amenities: parsed.data.amenities ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)

  if (error) {
    console.error('[updateUnit]', error)
    return { success: false, error: 'Failed to update unit. Please try again.' }
  }

  revalidatePath('/properties/' + (existing.property_id ?? parsed.data.property_id))
  return { success: true }
}
