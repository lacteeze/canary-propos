'use server'

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { TenantInviteEmail } from '@/lib/email/templates/TenantInviteEmail'
import { TeamInviteEmail } from '@/lib/email/templates/TeamInviteEmail'

// --- Schemas ---

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['manager', 'employee', 'tenant']),
  // Tenant-only fields (D-07)
  propertyAddress: z.string().optional(),
  unitNumber: z.string().optional(),
  moveInDate: z.string().optional(), // ISO date string
  firstName: z.string().optional(),
})

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

// --- inviteUser: send an invite email and upsert the people row (ORGS-01) ---
export async function inviteUser(formData: {
  email: string
  role: string
  // Tenant-only context (D-07)
  propertyAddress?: string
  unitNumber?: string
  moveInDate?: string // ISO date e.g. "2025-01-15"
  firstName?: string
}): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  // Authz: only manager/admin can invite (ORGS-01, T-06-03)
  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can invite team members.' }
  }

  // Validate input
  const parsed = inviteSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { email, role, propertyAddress, unitNumber, moveInDate, firstName } = parsed.data
  const orgId = ctx.person.org_id

  // Generate a unique invite token (T-06-02: single-use, accepted only once)
  const inviteToken = randomUUID()

  // Upsert the people row (create or update if email already invited)
  const { error: upsertError } = await ctx.supabase
    .from('people')
    .upsert(
      {
        org_id: orgId,
        email,
        role: [role],
        first_name: firstName ?? null,
        invite_token: inviteToken,
        invite_sent_at: new Date().toISOString(),
        invite_accepted_at: null, // reset to allow re-invite
        active: false,
      },
      { onConflict: 'org_id,email' }
    )

  if (upsertError) {
    console.error('[inviteUser] upsert error:', upsertError)
    return { success: false, error: 'Failed to create invite. Please try again.' }
  }

  // Fetch org name for email
  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single()

  const orgName = org?.name ?? 'Your property manager'

  // Build sign-up URL embedding the token
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const signUpUrl = `${baseUrl}/invite/${inviteToken}`

  // Send role-appropriate email
  let emailResult
  if (role === 'tenant') {
    // Format move-in date for display (D-07)
    const moveInDisplay = moveInDate
      ? new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(moveInDate))
      : 'To be confirmed'

    emailResult = await sendEmail({
      to: email,
      subject: `Your tenancy invite from ${orgName}`,
      template: createElement(TenantInviteEmail, {
        tenantFirstName: firstName ?? 'there',
        orgName,
        propertyAddress: propertyAddress ?? '',
        unitNumber: unitNumber ?? '',
        moveInDate: moveInDisplay,
        signUpUrl,
      }),
    })
  } else {
    emailResult = await sendEmail({
      to: email,
      subject: `You've been invited to join ${orgName}`,
      template: createElement(TeamInviteEmail, {
        inviteeEmail: email,
        orgName,
        role,
        signUpUrl,
      }),
    })
  }

  if (!emailResult.success) {
    return { success: false, error: 'Invite created but email failed to send. Please try again.' }
  }

  return { success: true }
}

// --- removeUserFromOrg: deactivate + revoke sessions immediately (D-11, ORGS-03, T-06-01) ---
export async function removeUserFromOrg(targetPersonId: string): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  // Authz: only manager/admin (T-06-03)
  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can remove team members.' }
  }

  const orgId = ctx.person.org_id

  // Fetch the target person — must be in the same org (RLS scoped)
  const { data: target, error: fetchError } = await ctx.supabase
    .from('people')
    .select('user_id, org_id, role')
    .eq('id', targetPersonId)
    .eq('org_id', orgId)
    .single()

  if (fetchError || !target) {
    return { success: false, error: 'Person not found in your organization.' }
  }

  // Prevent self-removal (edge-case safety)
  if (target.user_id === ctx.user.id) {
    return { success: false, error: 'You cannot remove yourself from the organization.' }
  }

  // Deactivate the people row
  const { error: deactivateError } = await ctx.supabase
    .from('people')
    .update({
      active: false,
      deactivated_at: new Date().toISOString(),
    })
    .eq('id', targetPersonId)
    .eq('org_id', orgId)

  if (deactivateError) {
    return { success: false, error: 'Failed to remove user. Please try again.' }
  }

  // Revoke all sessions immediately (D-11, T-06-01)
  // Uses service_role key via admin client — bypasses RLS
  if (target.user_id) {
    const admin = createAdminClient()
    const { error: signOutError } = await admin.auth.admin.signOut(target.user_id, 'global')
    if (signOutError) {
      // Log but don't fail the action — the row is already deactivated
      console.error('[removeUserFromOrg] signOut error:', signOutError)
    }
  }

  return { success: true }
}
