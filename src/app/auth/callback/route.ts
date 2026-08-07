import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  AUTH_PERSIST_COOKIE,
  applyAuthCookieMaxAge,
  isAuthPersistEnabled,
} from '@/lib/supabase/auth-persist'
import { createAdminClient } from '@/lib/supabase/admin'
import { portalPathForRole, primaryRoleFromClaim } from '@/lib/auth/role-redirect'
import { ensureJwtClaimsFromPeople } from '@/lib/auth/sync-jwt-claims'

async function acceptInviteToken(
  userId: string,
  userEmail: string | undefined,
  token: string,
  firstName?: string,
  lastName?: string,
): Promise<string | undefined> {
  const admin = createAdminClient()
  const { data: person } = await admin
    .from('people')
    .select('id, role, org_id, invite_accepted_at, email')
    .eq('invite_token', token)
    .maybeSingle()

  if (!person || person.invite_accepted_at) return undefined
  if (
    person.email &&
    userEmail &&
    person.email.trim().toLowerCase() !== userEmail.trim().toLowerCase()
  ) {
    return undefined
  }

  const { error } = await admin
    .from('people')
    .update({
      user_id: userId,
      invite_accepted_at: new Date().toISOString(),
      active: true,
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
    })
    .eq('id', person.id)
  if (error) {
    console.error('[auth/callback] invite accept failed', error)
    return undefined
  }

  const role = primaryRoleFromClaim(person.role as string[] | null) ?? 'tenant'
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      role,
      org_id: person.org_id,
      person_id: person.id,
    },
  })
  return role
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const inviteToken =
    searchParams.get('invite_token') ?? searchParams.get('invite') ?? null

  if (code) {
    const cookieStore = await cookies()
    const persist = isAuthPersistEnabled(
      cookieStore.get(AUTH_PERSIST_COOKIE)?.value,
    )
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, applyAuthCookieMaxAge(options, persist)),
            )
          },
        },
      },
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      let role = user?.app_metadata?.role as string | undefined

      const metaToken =
        inviteToken ||
        (user?.user_metadata?.invite_token as string | undefined) ||
        null

      if (user && metaToken) {
        const acceptedRole = await acceptInviteToken(
          user.id,
          user.email,
          metaToken,
          user.user_metadata?.first_name as string | undefined,
          user.user_metadata?.last_name as string | undefined,
        )
        if (acceptedRole) role = acceptedRole
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (user) {
        await ensureJwtClaimsFromPeople(supabase, user, session?.access_token)
        const {
          data: { user: fresh },
        } = await supabase.auth.getUser()
        role = (fresh?.app_metadata?.role as string | undefined) ?? role
      }

      const redirectPath = portalPathForRole(role)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin
      return NextResponse.redirect(new URL(redirectPath, appUrl))
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin
  return NextResponse.redirect(new URL('/auth-code-error', appUrl))
}
