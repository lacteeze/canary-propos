'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CANADIAN_PROVINCES } from '@/lib/constants/provinces'

const provinceCodes = CANADIAN_PROVINCES.map((p) => p.value) as [string, ...string[]]

const orgNameSchema = z.object({
  name: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(80, 'Organization name must be 80 characters or fewer'),
})

const provinceSchema = z.object({
  province: z.enum(provinceCodes, {
    error: 'Please select a valid Canadian province or territory',
  }),
})

const inviteEmailSchema = z.object({
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
})

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function primaryRole(roles: string[] | null | undefined): string {
  if (!roles?.length) return 'manager'
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('manager')) return 'manager'
  if (roles.includes('employee')) return 'employee'
  if (roles.includes('owner')) return 'owner'
  if (roles.includes('tenant')) return 'tenant'
  if (roles.includes('vendor')) return 'vendor'
  return roles[0] ?? 'manager'
}

export type ActionResult =
  | { success: true; orgId?: string; personId?: string }
  | { success: false; error: string }

async function injectClaims(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  orgId: string,
  personId: string,
  role: string,
  existingMeta: Record<string, unknown> | undefined,
) {
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...existingMeta,
      role,
      org_id: orgId,
      person_id: personId,
    },
  })
}

/** Creates org + manager people row, or re-syncs claims if already onboarded. */
export async function createOrganization(formData: {
  name: string
  province: string
  logoPath?: string | null
  inviteEmail?: string | null
}): Promise<ActionResult> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be signed in to create an organization.' }
  }

  // Idempotent: already has a people row → re-sync JWT claims and succeed
  const { data: existingPerson } = await admin
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle()

  if (existingPerson) {
    await injectClaims(
      admin,
      user.id,
      existingPerson.org_id,
      existingPerson.id,
      primaryRole(existingPerson.role as string[] | null),
      user.app_metadata as Record<string, unknown> | undefined,
    )
    await supabase.auth.refreshSession()
    return {
      success: true,
      orgId: existingPerson.org_id,
      personId: existingPerson.id,
    }
  }

  const nameResult = orgNameSchema.safeParse({ name: formData.name })
  if (!nameResult.success) {
    return {
      success: false,
      error: nameResult.error.issues[0]?.message ?? 'Invalid organization name.',
    }
  }

  const provinceResult = provinceSchema.safeParse({ province: formData.province })
  if (!provinceResult.success) {
    return {
      success: false,
      error: provinceResult.error.issues[0]?.message ?? 'Invalid province.',
    }
  }

  const inviteResult = inviteEmailSchema.safeParse({ email: formData.inviteEmail ?? '' })
  if (!inviteResult.success) {
    return {
      success: false,
      error: inviteResult.error.issues[0]?.message ?? 'Invalid invite email.',
    }
  }

  const baseSlug = slugify(formData.name)
  const slug = `${baseSlug}-${Date.now().toString(36)}`

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name: formData.name.trim(),
      slug,
      province: formData.province,
      logo_path: formData.logoPath ?? null,
      // Wizard finish = setup complete; optional logo/invite can be done later
      setup_completed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (orgError || !org) {
    console.error('[createOrganization] org insert failed', orgError)
    return {
      success: false,
      error: 'Something went wrong creating your organization. Please try again.',
    }
  }

  const { data: person, error: personError } = await admin
    .from('people')
    .insert({
      user_id: user.id,
      org_id: org.id,
      role: ['manager'],
      email: user.email ?? '',
      active: true,
      invite_accepted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (personError || !person) {
    console.error('[createOrganization] people insert failed', personError)
    return {
      success: false,
      error: 'Organization created but failed to set up your account. Please contact support.',
    }
  }

  await injectClaims(
    admin,
    user.id,
    org.id,
    person.id,
    'manager',
    user.app_metadata as Record<string, unknown> | undefined,
  )

  // Refresh session cookies so the access token carries org_id/role for RLS
  await supabase.auth.refreshSession()

  return { success: true, orgId: org.id, personId: person.id }
}

export async function updateOrgLogo(logoPath: string): Promise<ActionResult> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be signed in.' }
  }

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
