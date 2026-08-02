// GET /api/cron/rent-charges — generate monthly rent charges for active leases.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateRentChargesForAllOrgs } from '@/lib/billing/rent-charges'

export const runtime = 'nodejs'
export const maxDuration = 300

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })
  }
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const year = url.searchParams.get('year')
      ? Number(url.searchParams.get('year'))
      : undefined
    const month = url.searchParams.get('month')
      ? Number(url.searchParams.get('month'))
      : undefined

    const admin = createAdminClient()
    const result = await generateRentChargesForAllOrgs(admin, year, month)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/rent-charges]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cron failed' },
      { status: 500 }
    )
  }
}
