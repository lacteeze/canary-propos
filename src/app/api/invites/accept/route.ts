// src/app/api/invites/accept/route.ts
// POST /api/invites/accept — links a newly-signed-up user to their invite (ORGS-02, T-06-02)
// Uses admin client to bypass RLS for the update + inject JWT claims.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { primaryRoleFromClaim, portalPathForRole } from '@/lib/auth/role-redirect'
import {
  AUTH_PERSIST_COOKIE,
  applyAuthCookieMaxAge,
  isAuthPersistEnabled,
} from '@/lib/supabase/auth-persist'

const bodySchema = z.object({
  token: z.string().uuid('Invalid token format'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const persist = isAuthPersistEnabled(
    cookieStore.get(AUTH_PERSIST_COOKIE)?.value,
  )
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, applyAuthCookieMaxAge(options, persist)),
          )
        },
      },
    },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  const { token, firstName, lastName } = parsed.data
  const userId = user.id
  const admin = createAdminClient()

  const { data: person, error: fetchError } = await admin
    .from('people')
    .select('id, role, org_id, invite_accepted_at, email')
    .eq('invite_token', token)
    .single()

  if (fetchError || !person) {
    return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
  }

  if (person.invite_accepted_at) {
    return NextResponse.json({ error: 'Invite already accepted.' }, { status: 410 })
  }

  // Guard: invite email must match the signed-in user
  if (
    person.email &&
    user.email &&
    person.email.trim().toLowerCase() !== user.email.trim().toLowerCase()
  ) {
    return NextResponse.json(
      { error: 'Signed-in email does not match this invite.' },
      { status: 403 },
    )
  }

  const { error: updateError } = await admin
    .from('people')
    .update({
      user_id: userId,
      invite_accepted_at: new Date().toISOString(),
      active: true,
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
    })
    .eq('id', person.id)

  if (updateError) {
    console.error('[accept invite] update error:', updateError)
    return NextResponse.json({ error: 'Failed to accept invite.' }, { status: 500 })
  }

  const role = primaryRoleFromClaim(person.role as string[] | null) ?? 'tenant'

  // Inject JWT claims immediately so the next navigation has RLS context
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...user.app_metadata,
      role,
      org_id: person.org_id,
      person_id: person.id,
    },
  })
  await supabase.auth.refreshSession()

  return NextResponse.json({
    success: true,
    role,
    redirect: portalPathForRole(role),
  })
}
