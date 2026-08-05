// Handles Google OAuth redirect after the manager authorizes Google Tasks.
// Flow: Google → GET /api/google-tasks/callback?code=...&state=<orgId>
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeTasksCodeForTokens } from '@/lib/google-tasks'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const orgId = searchParams.get('state')

  if (!code || !orgId) {
    return NextResponse.redirect(
      new URL('/settings?tasks=error&reason=missing_params', request.url),
    )
  }

  let tokens: { access_token: string; refresh_token: string; expiry_date: number }
  try {
    tokens = await exchangeTasksCodeForTokens(code)
  } catch (err) {
    console.error('[google-tasks/callback] token exchange failed:', err)
    return NextResponse.redirect(
      new URL('/settings?tasks=error&reason=token_exchange', request.url),
    )
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('organizations')
    .update({
      tasks_access_token: tokens.access_token,
      tasks_refresh_token: tokens.refresh_token,
      tasks_token_expiry: tokens.expiry_date,
      tasks_connected_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (error) {
    console.error('[google-tasks/callback] DB update failed:', error)
    return NextResponse.redirect(
      new URL('/settings?tasks=error&reason=db_update', request.url),
    )
  }

  return NextResponse.redirect(new URL('/settings?tasks=connected', request.url))
}
