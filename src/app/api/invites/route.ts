// src/app/api/invites/route.ts
// GET /api/invites?token=<token> — validates an invite token and returns invite metadata.
// Used by the invite acceptance page to pre-populate context before sign-up.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Missing token.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Look up invite by token where not yet accepted (T-06-02: single-use)
  const { data: person, error } = await admin
    .from('people')
    .select('id, email, role, org_id, invite_accepted_at, organizations(name)')
    .eq('invite_token', token)
    .single()

  if (error || !person) {
    return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
  }

  if (person.invite_accepted_at) {
    return NextResponse.json({ error: 'already_accepted' }, { status: 410 })
  }

  return NextResponse.json({
    email: person.email,
    role: person.role,
    orgName: (person.organizations as { name: string } | null)?.name ?? '',
    personId: person.id,
  })
}
