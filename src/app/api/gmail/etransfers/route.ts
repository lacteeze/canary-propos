// src/app/api/gmail/etransfers/route.ts
// GET /api/gmail/etransfers
// Returns parsed Interac e-transfer suggestions from the org's connected Gmail inbox.
//
// PAY-03: Suggestions ONLY — no auto-confirm logic. Manager must explicitly call
// recordPayment (Plan 04-04) to match a suggestion to a lease/tenant.
//
// Security (T-04-10): Requires manager session. Uses org's own stored tokens only.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshTokenIfNeeded, searchETransfers } from '@/lib/gmail'

export async function GET(request: NextRequest) {
  // Silence unused variable warning — request used for route registration
  void request

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // Resolve caller's person record to get org_id and role
  const { data: person } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // T-04-10: only managers and admins may fetch e-transfer suggestions
  if (!person.role?.includes('manager') && !person.role?.includes('admin')) {
    return NextResponse.json(
      { error: 'Only managers can access e-transfer suggestions.' },
      { status: 401 },
    )
  }

  let accessToken: string
  try {
    accessToken = await refreshTokenIfNeeded(person.org_id, supabase)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gmail not connected.'
    // Return empty array (not an error) if Gmail has not been connected yet
    if (message.includes('not connected') || message.includes('not found')) {
      return NextResponse.json([], { status: 200 })
    }
    console.error('[gmail/etransfers] token refresh failed:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  try {
    const suggestions = await searchETransfers(accessToken)
    return NextResponse.json(suggestions, { status: 200 })
  } catch (err) {
    console.error('[gmail/etransfers] Gmail search failed:', err)
    return NextResponse.json(
      { error: 'Failed to search Gmail. Please try again.' },
      { status: 500 },
    )
  }
}
