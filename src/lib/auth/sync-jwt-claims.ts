// Syncs auth JWT app_metadata with the people row so RLS helpers
// (org_id / user_role / person_id) match the database after onboarding.
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

type JwtAppMeta = {
  org_id?: string
  role?: string
  person_id?: string | null
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
  if (!roles?.length) return 'manager'
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('manager')) return 'manager'
  if (roles.includes('employee')) return 'employee'
  if (roles.includes('owner')) return 'owner'
  if (roles.includes('tenant')) return 'tenant'
  if (roles.includes('vendor')) return 'vendor'
  return roles[0] ?? 'manager'
}

/**
 * If the signed-in user has a people row but the session JWT lacks org/role
 * claims (common right after onboarding), write claims + refresh the session
 * so subsequent RLS queries succeed.
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
  const { data: person } = await admin
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle()

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
