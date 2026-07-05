'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// --- Action result type ---
export type ActionResult =
  | { success: true }
  | { success: false; error: string }

// --- Helper: resolve the caller's org + role ---
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

// --- Shared contact schema ---
// T-02-06: roles enum excludes 'admin' — elevation of privilege prevention
const contactSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  roles: z
    .array(z.enum(['tenant', 'owner', 'vendor']))
    .min(1, 'At least one role is required'),
})

// --- createContact ---
export async function createContact(formData: {
  first_name: string
  last_name: string
  email: string
  phone?: string
  roles: string[]
}): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  // Authz: only manager or admin can create contacts
  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can create contacts.' }
  }

  const parsed = contactSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { first_name, last_name, email, phone, roles } = parsed.data

  // T-02-08: scoped by org_id — RLS also enforces org boundary
  const { error: insertError } = await ctx.supabase
    .from('people')
    .insert({
      org_id: ctx.person.org_id,
      first_name,
      last_name,
      email,
      phone: phone ?? null,
      role: roles, // text[] — pass array directly
      active: true,
    })

  if (insertError) {
    console.error('[createContact] insert error:', insertError)
    return { success: false, error: 'Failed to create contact. Please try again.' }
  }

  revalidatePath('/people')
  return { success: true }
}

// --- updateContact ---
// T-02-07: org ownership verified before update
export async function updateContact(
  id: string,
  formData: {
    first_name: string
    last_name: string
    email: string
    phone?: string
    roles: string[]
  }
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can edit contacts.' }
  }

  const parsed = contactSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { first_name, last_name, email, phone, roles } = parsed.data

  // Verify org ownership before update (T-02-07)
  const { data: existing, error: fetchError } = await ctx.supabase
    .from('people')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Contact not found in your organization.' }
  }

  const { error: updateError } = await ctx.supabase
    .from('people')
    .update({
      first_name,
      last_name,
      email,
      phone: phone ?? null,
      role: roles,
    })
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)

  if (updateError) {
    console.error('[updateContact] update error:', updateError)
    return { success: false, error: 'Failed to update contact. Please try again.' }
  }

  revalidatePath('/people')
  return { success: true }
}

// --- deactivateContact ---
export async function deactivateContact(id: string): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can deactivate contacts.' }
  }

  // Verify org ownership (T-02-07)
  const { data: existing, error: fetchError } = await ctx.supabase
    .from('people')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Contact not found in your organization.' }
  }

  const { error: updateError } = await ctx.supabase
    .from('people')
    .update({ active: false, deactivated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)

  if (updateError) {
    console.error('[deactivateContact] update error:', updateError)
    return { success: false, error: 'Failed to deactivate contact. Please try again.' }
  }

  revalidatePath('/people')
  return { success: true }
}
