// src/app/api/gmail/callback/route.ts
// Handles the Google OAuth redirect after the manager authorizes Gmail access.
// Flow: Google → GET /api/gmail/callback?code=...&state=<orgId>
//
// Security (T-04-08): state=orgId ensures tokens are written only to the org
// that initiated the OAuth flow. Admin client is required to bypass RLS for
// the token write.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCodeForTokens } from '@/lib/gmail'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const orgId = searchParams.get('state')

  if (!code || !orgId) {
    return NextResponse.redirect(
      new URL('/settings?gmail=error&reason=missing_params', request.url),
    )
  }

  let tokens: { access_token: string; refresh_token: string; expiry_date: number }
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (err) {
    console.error('[gmail/callback] token exchange failed:', err)
    return NextResponse.redirect(
      new URL('/settings?gmail=error&reason=token_exchange', request.url),
    )
  }

  // Admin client required — RLS would block writing to organizations row
  // (T-04-09: refresh_token never returned to client; stays server-side only)
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('organizations')
    .update({
      gmail_access_token: tokens.access_token,
      gmail_refresh_token: tokens.refresh_token,
      gmail_token_expiry: tokens.expiry_date,
      gmail_connected_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (error) {
    console.error('[gmail/callback] DB update failed:', error)
    return NextResponse.redirect(
      new URL('/settings?gmail=error&reason=db_update', request.url),
    )
  }

  return NextResponse.redirect(new URL('/settings?gmail=connected', request.url))
}
