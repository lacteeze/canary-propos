/**
 * Smoke-test listing inquiry + application notifications via Pingram.
 *
 * Usage: node scripts/test-inquiry-emails.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const key = line.slice(0, i).trim()
    let val = line.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

loadEnvLocal()

const LISTING_ID = process.env.TEST_LISTING_ID || 'a6301b8c-b526-4843-8017-004e57be49b2'
const ORG_ID = process.env.TEST_ORG_ID || '5ed97bbf-9e4b-4dd7-b886-f028dd7b0a21'
const stamp = new Date().toISOString().replace(/[:.]/g, '-')

const results = {
  env: {
    PINGRAM_API_KEY: Boolean(process.env.PINGRAM_API_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  },
  listing: null,
  managerEmail: null,
  inquiryEmail: null,
  applicationEmail: null,
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anon) {
  console.error(JSON.stringify({ ok: false, error: 'Missing Supabase public env', results }, null, 2))
  process.exit(1)
}

const publicClient = createClient(url, anon)
const admin = service
  ? createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

const { data: listing, error: listingErr } = await publicClient
  .from('listings')
  .select('id, org_id, listing_title, status')
  .eq('id', LISTING_ID)
  .eq('status', 'published')
  .single()

results.listing = listingErr
  ? { ok: false, error: listingErr.message }
  : { ok: true, id: listing.id, title: listing.listing_title, org_id: listing.org_id }

if (!listing || listing.org_id !== ORG_ID) {
  console.error(JSON.stringify({ ok: false, error: 'Published listing validation failed', results }, null, 2))
  process.exit(1)
}

if (admin) {
  const { data: manager, error: mgrErr } = await admin
    .from('people')
    .select('email')
    .eq('org_id', ORG_ID)
    .contains('role', ['manager'])
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  results.managerEmail = mgrErr
    ? { ok: false, error: mgrErr.message }
    : { ok: Boolean(manager?.email), email: manager?.email ?? null }
} else {
  results.managerEmail = { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' }
}

async function sendPingram({ type, subject, html, to }) {
  if (!process.env.PINGRAM_API_KEY) {
    return { ok: false, error: 'PINGRAM_API_KEY is not set in .env.local' }
  }

  // Dynamic import so this script matches the app SDK path
  const { Pingram } = await import('pingram')
  const client = new Pingram({ apiKey: process.env.PINGRAM_API_KEY, region: 'ca' })
  try {
    await client.send({
      type,
      to: { id: to, email: to },
      email: {
        subject,
        html,
        senderName: 'Canary PM',
        senderEmail: 'notifications@canarypm.ca',
      },
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

const to = results.managerEmail?.email
if (!to) {
  results.inquiryEmail = { ok: false, error: 'No manager email to notify' }
  results.applicationEmail = { ok: false, error: 'No manager email to notify' }
} else {
  results.inquiryEmail = await sendPingram({
    to,
    type: 'inquiry_notification',
    subject: `New showing request: ${listing.listing_title}`,
    html: `<p>Smoke test showing request for <b>${listing.listing_title}</b>.</p><p>Stamp: ${stamp}</p>`,
  })
  results.applicationEmail = await sendPingram({
    to,
    type: 'inquiry_notification',
    subject: `New application: ${listing.listing_title}`,
    html: `<p>Smoke test application for <b>${listing.listing_title}</b>.</p><p>Stamp: ${stamp}</p>`,
  })
}

const ok = Boolean(results.inquiryEmail?.ok && results.applicationEmail?.ok)

console.log(
  JSON.stringify(
    {
      ok,
      summary: {
        emailInquiry: results.inquiryEmail?.ok,
        emailApplication: results.applicationEmail?.ok,
        managerTo: to ?? null,
        listing: listing.listing_title,
      },
      results,
    },
    null,
    2,
  ),
)

process.exit(ok ? 0 : 2)
