// GET /api/cron/drive-photo-sync
// Syncs listing photos from linked Drive folders for all properties.
// Secured with CRON_SECRET (Authorization: Bearer <secret>).
// Schedule: vercel.json cron daily at 12:00 UTC (Hobby plan allows at most one run/day).
// Upgrade to Vercel Pro to use */30 if near-real-time Drive sync is needed.

import { NextRequest, NextResponse } from 'next/server'
import { syncAllLinkedDriveFolders } from '@/lib/drive-photo-sync'

export const runtime = 'nodejs'
export const maxDuration = 300

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true

  // Vercel Cron sends CRON_SECRET as Authorization Bearer automatically when configured
  const vercelCron = request.headers.get('x-vercel-cron')
  if (vercelCron === '1' && auth === `Bearer ${secret}`) return true

  return false
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured.' },
      { status: 503 },
    )
  }

  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncAllLinkedDriveFolders()
    return NextResponse.json({
      ok: true,
      properties: result.properties,
      imported: result.stats.imported,
      replaced: result.stats.replaced,
      skipped: result.stats.skipped,
      missingOnDrive: result.stats.missingOnDrive,
      foundOnDrive: result.stats.foundOnDrive,
      errors: [...result.errors, ...result.stats.errors].slice(0, 50),
    })
  } catch (err) {
    console.error('[cron/drive-photo-sync]', err)
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
