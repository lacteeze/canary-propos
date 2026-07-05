'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CANADIAN_PROVINCES } from '@/lib/constants/provinces'

// --- Zod schemas for server-side validation (T-05-03) ---

const provinceCodes = CANADIAN_PROVINCES.map((p) => p.value) as [string, ...string[]]

const orgNameSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(80, 'Organization name must be 80 characters or fewer'),
})

const provinceSchema = z.object({
  province: z.enum(provinceCodes, { error: 'Please select a valid Canadian province or territory' }),
})

const inviteEmailSchema = z.object({
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
})

// --- Helper: generate slug from org name ---
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

// --- Action result type ---
export type ActionResult =
  | { success: true; orgId?: string }
  | { success: false; error: string }

// --- createOrganization: inserts org + manager person row (FOUND-01) ---
export async function createOrganization(formData: {
  name: string
  province: string
  logoPath?: string | null
  inviteEmail?: string | null
}): Promise<ActionResult> {
  // Use user client only to verify the session — inserts use admin client
  // because new users have no JWT claims yet (Auth Hook needs a people row to inject claims,
  // but we haven't created one yet — classic chicken-and-egg bootstrap).
  const supabase = await createClient()
  const admin = createAdminClient()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be signed in to create an organization.' }
  }

  // Validate org name
  const nameResult = orgNameSchema.safeParse({ name: formData.name })
  if (!nameResult.success) {
    return { success: false, error: nameResult.error.issues[0]?.message ?? 'Invalid organization name.' }
  }

  // Validate province
  const provinceResult = provinceSchema.safeParse({ province: formData.province })
  if (!provinceResult.success) {
    return { success: false, error: provinceResult.error.issues[0]?.message ?? 'Invalid province.' }
  }

  // Validate invite email (optional)
  const inviteResult = inviteEmailSchema.safeParse({ email: formData.inviteEmail ?? '' })
  if (!inviteResult.success) {
    return { success: false, error: inviteResult.error.issues[0]?.message ?? 'Invalid invite email.' }
  }

  const hasSkippedOptionalSteps =
    !formData.logoPath && (!formData.inviteEmail || formData.inviteEmail.trim() === '')

  // Generate a unique slug
  const baseSlug = slugify(formData.name)
  const slug = `${baseSlug}-${Date.now().toString(36)}`

  // Insert organization via admin client (bypasses RLS for bootstrap — user has no claims yet)
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name: formData.name.trim(),
      slug,
      province: formData.province,
      logo_path: formData.logoPath ?? null,
      setup_completed_at: hasSkippedOptionalSteps ? null : new Date().toISOString(),
    })
    .select('id')
    .single()

  if (orgError || !org) {
    return {
      success: false,
      error: 'Something went wrong creating your organization. Please try again.',
    }
  }

  // Insert manager people row via admin client (FOUND-01)
  // After this insert, the Auth Hook will inject org_id + role into JWT on next sign-in
  const { error: personError } = await admin.from('people').insert({
    user_id: user.id,
    org_id: org.id,
    role: ['manager'],
    email: user.email ?? '',
    invite_accepted_at: new Date().toISOString(),
  })

  if (personError) {
    return {
      success: false,
      error: 'Organization created but failed to set up your account. Please contact support.',
    }
  }

  // Immediately inject JWT claims into app_metadata so the user can access /dashboard
  // without needing to sign out and back in (Auth Hook fires on sign-in, not on creation).
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      role: 'manager',
      org_id: org.id,
      person_id: null, // will be populated on next sign-in via Auth Hook lookup
    },
  })

  return { success: true, orgId: org.id }
}

// --- updateOrgLogo: update logo_path — org derived from JWT claims, never user input (CR-03) ---
export async function updateOrgLogo(logoPath: string): Promise<ActionResult> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be signed in.' }
  }

  // CR-03 fix: derive org_id from JWT claims, never accept it from the caller
  const orgId = user.app_metadata?.org_id as string | undefined
  if (!orgId) {
    return { success: false, error: 'Organisation not found.' }
  }

  const { error } = await admin
    .from('organizations')
    .update({ logo_path: logoPath })
    .eq('id', orgId)

  if (error) {
    return { success: false, error: 'Failed to save logo. Please try again.' }
  }

  return { success: true }
}
