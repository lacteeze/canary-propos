// src/app/api/drive/callback/route.ts
// Handles the Google OAuth redirect after the manager authorizes Drive access.
// Flow: Google → GET /api/drive/callback?code=...&state=<orgId>
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeDriveCodeForTokens } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const orgId = searchParams.get('state')

  if (!code || !orgId) {
    return NextResponse.redirect(
      new URL('/settings?drive=error&reason=missing_params', request.url),
    )
  }

  let tokens: { access_token: string; refresh_token: string; expiry_date: number }
  try {
    tokens = await exchangeDriveCodeForTokens(code)
  } catch (err) {
    console.error('[drive/callback] token exchange failed:', err)
    return NextResponse.redirect(
      new URL('/settings?drive=error&reason=token_exchange', request.url),
    )
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('organizations')
    .update({
      drive_access_token: tokens.access_token,
      drive_refresh_token: tokens.refresh_token,
      drive_token_expiry: tokens.expiry_date,
      drive_connected_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (error) {
    console.error('[drive/callback] DB update failed:', error)
    return NextResponse.redirect(
      new URL('/settings?drive=error&reason=db_update', request.url),
    )
  }

  return NextResponse.redirect(new URL('/settings?drive=connected', request.url))
}
