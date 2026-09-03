import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/gmail'
import { upsertOrgIntegration } from '@/lib/org-integrations'
import { OAUTH_STATE_COOKIE, clearOAuthStateCookie } from '@/lib/oauth-state'

function isManagerOrAdmin(role: string[] | string | null | undefined): boolean {
  const roles = Array.isArray(role) ? role : role ? [role] : []
  return roles.some((r) => r.includes('manager') || r.includes('admin'))
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value

  const fail = (reason: string) => {
    const res = NextResponse.redirect(
      new URL(`/settings?gmail=error&reason=${reason}`, request.url),
    )
    clearOAuthStateCookie(res)
    return res
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return fail('missing_params')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('unauthorized')

  const { data: person } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person || !isManagerOrAdmin(person.role)) return fail('unauthorized')

  const orgId = person.org_id

  let tokens: { access_token: string; refresh_token: string; expiry_date: number }
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (err) {
    console.error('[gmail/callback] token exchange failed:', err)
    return fail('token_exchange')
  }

  try {
    await upsertOrgIntegration(orgId, 'gmail', {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokens.expiry_date,
    })
  } catch (err) {
    console.error('[gmail/callback] integration write failed:', err)
    return fail('db_update')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('organizations')
    .update({ gmail_connected_at: new Date().toISOString() })
    .eq('id', orgId)

  if (error) {
    console.error('[gmail/callback] connected_at update failed:', error)
    return fail('db_update')
  }

  const res = NextResponse.redirect(new URL('/settings?gmail=connected', request.url))
  clearOAuthStateCookie(res)
  return res
}
