'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
    .select('org_id, role')
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

  const { error } = await ctx.supabase.from('properties').insert({
    org_id: ctx.person.org_id,
    street_address: parsed.data.street_address,
    city: parsed.data.city,
    province: parsed.data.province,
    postal_code: parsed.data.postal_code ?? null,
    property_type: parsed.data.property_type,
    owner_id: parsed.data.owner_id ?? null,
    portfolio_id: parsed.data.portfolio_id ?? null,
  })

  if (error) {
    console.error('[createProperty]', error)
    return { success: false, error: 'Failed to create property. Please try again.' }
  }

  revalidatePath('/properties')
  return { success: true }
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
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Property not found.' }
  }

  const { error } = await ctx.supabase
    .from('properties')
    .update({
      street_address: parsed.data.street_address,
      city: parsed.data.city,
      province: parsed.data.province,
      postal_code: parsed.data.postal_code ?? null,
      property_type: parsed.data.property_type,
      owner_id: parsed.data.owner_id ?? null,
      portfolio_id: parsed.data.portfolio_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)

  if (error) {
    console.error('[updateProperty]', error)
    return { success: false, error: 'Failed to update property. Please try again.' }
  }

  revalidatePath('/properties')
  revalidatePath('/properties/' + id)
  return { success: true }
}
