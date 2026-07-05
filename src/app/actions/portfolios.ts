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
const portfolioSchema = z.object({
  name: z.string().min(1, 'Portfolio name is required'),
  owner_id: z.string().uuid().optional().nullable(),
})

// --- createPortfolio ---
export async function createPortfolio(data: {
  name: string
  owner_id?: string | null
}): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can create portfolios.' }
  }

  const parsed = portfolioSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { error } = await ctx.supabase.from('portfolios').insert({
    org_id: ctx.person.org_id,
    name: parsed.data.name,
    owner_id: parsed.data.owner_id ?? null,
  })

  if (error) {
    console.error('[createPortfolio]', error)
    return { success: false, error: 'Failed to create portfolio. Please try again.' }
  }

  revalidatePath('/properties')
  return { success: true }
}
