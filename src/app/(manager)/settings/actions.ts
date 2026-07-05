'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { CANADIAN_PROVINCES } from '@/lib/constants/provinces'
import { getGmailAuthUrl } from '@/lib/gmail'

const provinceCodes = CANADIAN_PROVINCES.map((p) => p.value) as [string, ...string[]]

const updateOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(80, 'Organization name must be 80 characters or fewer'),
  province: z.enum(provinceCodes, { error: 'Please select a valid Canadian province or territory' }),
  logoPath: z.string().nullable().optional(),
})

export type UpdateOrgResult =
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
  return { supabase, person }
}

// --- updateOrgProfile: saves org name / province / logo (ORGS-04) ---
export async function updateOrgProfile(formData: {
  name: string
  province: string
  logoPath?: string | null
}): Promise<UpdateOrgResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  // Authz: only manager/admin (T-06-03)
  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can update organization settings.' }
  }

  const parsed = updateOrgSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { name, province, logoPath } = parsed.data

  const { error } = await ctx.supabase
    .from('organizations')
    .update({
      name: name.trim(),
      province,
      updated_at: new Date().toISOString(),
      ...(logoPath !== undefined ? { logo_path: logoPath } : {}),
    })
    .eq('id', ctx.person.org_id)

  if (error) {
    console.error('[updateOrgProfile] error:', error)
    return { success: false, error: 'Failed to save changes. Please try again.' }
  }

  return { success: true }
}

// --- getGmailConnectUrl: generates Google OAuth URL for Gmail connection (PAY-03) ---
export async function getGmailConnectUrl(): Promise<UpdateOrgResult & { url?: string }> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can connect Gmail.' }
  }

  try {
    const url = getGmailAuthUrl(ctx.person.org_id)
    return { success: true, url }
  } catch (err) {
    console.error('[getGmailConnectUrl] failed:', err)
    return { success: false, error: 'Failed to generate Gmail authorization URL.' }
  }
}

// --- disconnectGmail: clears all gmail_* columns on the org row (PAY-03) ---
export async function disconnectGmail(_orgId?: string): Promise<UpdateOrgResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can disconnect Gmail.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any)
    .from('organizations')
    .update({
      gmail_access_token: null,
      gmail_refresh_token: null,
      gmail_token_expiry: null,
      gmail_connected_at: null,
    })
    .eq('id', ctx.person.org_id)

  if (error) {
    console.error('[disconnectGmail] error:', error)
    return { success: false, error: 'Failed to disconnect Gmail.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

// --- markSetupComplete: sets setup_completed_at (D-02) ---
export async function markSetupComplete(): Promise<UpdateOrgResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can complete setup.' }
  }

  const { error } = await ctx.supabase
    .from('organizations')
    .update({ setup_completed_at: new Date().toISOString() })
    .eq('id', ctx.person.org_id)

  if (error) {
    return { success: false, error: 'Failed to mark setup complete.' }
  }

  return { success: true }
}
