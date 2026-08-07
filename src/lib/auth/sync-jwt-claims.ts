// Syncs auth JWT app_metadata with the people row so RLS helpers
// (org_id / user_role / person_id) match the database after onboarding.
// Also links auth users to unlinked people rows by email (manager-uploaded tenants).
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { primaryRoleFromClaim } from '@/lib/auth/role-redirect'

type JwtAppMeta = {
  org_id?: string
  role?: string
  person_id?: string | null
}

type PersonRow = {
  id: string
  org_id: string
  role: string[] | null
}

/** Decode app_metadata from the access token (what PostgREST RLS actually sees). */
export function jwtAppMetadata(accessToken: string | undefined | null): JwtAppMeta {
  if (!accessToken) return {}
  try {
    const payload = accessToken.split('.')[1]
    if (!payload) return {}
    const json = JSON.parse(
      typeof atob === 'function'
        ? atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        : Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { app_metadata?: JwtAppMeta }
    return json.app_metadata ?? {}
  } catch {
    return {}
  }
}

function primaryRole(roles: string[] | null | undefined): string {
  return primaryRoleFromClaim(roles) ?? 'manager'
}

/**
 * Link auth.users → people when managers already uploaded the email
 * (user_id null) or left a pending invite token. Returns the linked row.
 */
async function linkPersonByEmail(user: User): Promise<PersonRow | null> {
  const email = user.email?.trim().toLowerCase()
  if (!email) return null

  const admin = createAdminClient()
  const { data: candidates } = await admin
    .from('people')
    .select('id, org_id, role, invite_token, active')
    .ilike('email', email)
    .is('user_id', null)
    .order('invite_sent_at', { ascending: false, nullsFirst: false })
    .limit(5)

  if (!candidates?.length) return null

  // Prefer portal invitees / tenant-vendor-owner roles over bare contacts
  const ranked = [...candidates].sort((a, b) => {
    const score = (p: (typeof candidates)[0]) => {
      let s = 0
      if (p.invite_token) s += 4
      const roles = (p.role as string[] | null) ?? []
      if (roles.some((r) => ['tenant', 'vendor', 'owner', 'manager', 'employee', 'admin'].includes(r))) {
        s += 2
      }
      if (p.active) s += 1
      return s
    }
    return score(b) - score(a)
  })

  const match = ranked[0]
  const { error } = await admin
    .from('people')
    .update({
      user_id: user.id,
      invite_accepted_at: new Date().toISOString(),
      active: true,
    })
    .eq('id', match.id)
    .is('user_id', null)

  if (error) {
    console.error('[linkPersonByEmail] failed', error)
    return null
  }

  return {
    id: match.id,
    org_id: match.org_id,
    role: match.role as string[] | null,
  }
}

/**
 * If the signed-in user has a people row but the session JWT lacks org/role
 * claims (common right after onboarding), write claims + refresh the session
 * so subsequent RLS queries succeed.
 *
 * Also completes email→people linkage for manager-uploaded tenant/vendor emails.
 *
 * Safe to call from middleware (can write cookies) or Server Actions.
 */
export async function ensureJwtClaimsFromPeople(
  supabase: SupabaseClient,
  user: User,
  accessToken: string | null | undefined,
): Promise<boolean> {
  const tokenMeta = jwtAppMetadata(accessToken)
  const userMeta = (user.app_metadata ?? {}) as JwtAppMeta

  // JWT already has org membership — nothing to do
  if (tokenMeta.org_id && tokenMeta.role) {
    return false
  }

  // Auth user record has claims but access token is stale → refresh only
  if (userMeta.org_id && userMeta.role && (!tokenMeta.org_id || !tokenMeta.role)) {
    const { error } = await supabase.auth.refreshSession()
    return !error
  }

  // No claims anywhere — look up people row (bypass RLS) and inject
  const admin = createAdminClient()
  let person: PersonRow | null =
    (
      await admin
        .from('people')
        .select('id, org_id, role')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle()
    ).data

  // Manager uploaded email / pending invite — link auth user to people row
  if (!person) {
    person = await linkPersonByEmail(user)
  }

  if (!person) return false

  const role = primaryRole(person.role as string[] | null)
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...user.app_metadata,
      role,
      org_id: person.org_id,
      person_id: person.id,
    },
  })

  const { error } = await supabase.auth.refreshSession()
  return !error
}
