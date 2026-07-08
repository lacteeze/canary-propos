// src/app/api/canary/ask/route.ts
// "Ask Canary" — answers questions about the caller's live data.
// Uses the Anthropic API when ANTHROPIC_API_KEY is configured; the data
// snapshot is built server-side from RLS-scoped Supabase queries.
import { NextResponse, type NextRequest } from 'next/server'
import { getCaller, loadCanaryDb } from '@/lib/canary/load-db'

export const dynamic = 'force-dynamic'

type InMsg = { role: 'user' | 'assistant'; text: string }

function cap<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n)
}

export async function POST(request: NextRequest) {
  const caller = await getCaller()
  if (caller === 'no-user' || caller === 'no-person') {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      reply:
        'The data assistant is not configured yet — set ANTHROPIC_API_KEY on the server to enable Ask Canary. Everything else in the app works without it.',
    })
  }

  let body: { messages?: InMsg[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const messages = (body.messages ?? []).filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string'
  )
  if (!messages.length) {
    return NextResponse.json({ error: 'No messages provided.' }, { status: 400 })
  }

  const db = await loadCanaryDb(caller.orgId)
  const activeProperties = db.properties.filter((p) => !p.archivedAt)

  const snapshot = {
    properties: cap(
      activeProperties.map((p) => ({
        address: p.address, status: p.status, beds: p.beds, baths: p.baths,
        rate: p.rate, city: p.city, type: p.type,
      })),
      150
    ),
    leases: cap(
      db.leases.map((l) => ({
        property: l.property, status: l.status, start: l.start, end: l.end,
        rent: l.rent, tenants: l.tenantInfo.split(':')[0] || '',
      })),
      200
    ),
    projects: cap(
      db.projects.map((j) => ({
        name: j.name, property: j.property, status: j.status,
        priority: j.priority, description: (j.description || '').slice(0, 160),
      })),
      100
    ),
    portfolios: cap(
      db.portfolios.map((pf) => ({
        name: pf.name,
        properties: activeProperties.filter((p) => p.portfolioId === pf.id).length,
      })),
      60
    ),
    listings: cap(
      db.drafts.map((d) => ({ address: d.address, rent: d.rent, status: d.status, available: d.start })),
      60
    ),
  }
  const occ = activeProperties.length
    ? Math.round(
        (activeProperties.filter((p) => p.status === 'Leased').length / activeProperties.length) * 100
      )
    : 0

  const system =
    "You are the data assistant inside Canary PM, a property-management app for St. John's, Newfoundland. Today is " +
    new Date().toDateString() +
    '.\nSnapshot: ' + activeProperties.length + ' properties, ' + occ + '% occupied, ' +
    db.leases.filter((l) => l.status === 'Active' || l.status === 'Expiring').length +
    ' active leases, ' + db.projects.length + ' projects on file.\n' +
    'The full data snapshot (JSON) follows — answer only from it; never invent numbers. ' +
    'Answer in plain text (no markdown symbols), concise and specific — lead with the answer, use short lines or simple lists. ' +
    'Format money as $1,234. When listing many items, show the most relevant 5-8 and say how many more there are.\n\nDATA:\n' +
    JSON.stringify(snapshot)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5',
        max_tokens: 1500,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.text })),
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error('[ask-canary] anthropic error', res.status, errText)
      return NextResponse.json({ reply: 'Sorry — the assistant hit an error. Please try again.' })
    }
    const data = await res.json()
    const reply = Array.isArray(data.content)
      ? data.content
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { text: string }) => c.text)
          .join('\n')
      : ''
    return NextResponse.json({ reply: reply || 'Sorry — no answer came back. Please try again.' })
  } catch (err) {
    console.error('[ask-canary]', err)
    return NextResponse.json({ reply: 'Sorry — the assistant is unreachable right now.' })
  }
}
