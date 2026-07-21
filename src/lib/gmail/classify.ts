import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClassificationResult, EmailCategory, ParsedGmailMessage } from './types'

type PersonRow = {
  id: string
  email: string
  role: string[] | null
  first_name: string | null
  last_name: string | null
}

type LeaseLink = {
  tenant_id: string | null
  unit_id: string | null
  units: { id: string; property_id: string | null } | { id: string; property_id: string | null }[] | null
}

const INVOICE_HINTS = /\b(invoice|inv[#:\s-]\d|amount due|payment due|bill to|tax invoice)\b/i
const RECEIPT_HINTS = /\b(receipt|payment received|paid in full|order confirmation|your payment)\b/i
const MAINTENANCE_HINTS = /\b(leak|broken|repair|maintenance|work order|plumb|furnace|heat|hot water)\b/i
const SPAM_HINTS =
  /\b(viagra|crypto giveaway|you have won|nigerian|act now!!!|unsubscribe from this list)\b/i
const INTERNAL_DOMAINS = ['canarypm.ca', 'canarypropertymanagement.com']

function roleToCategory(roles: string[] | null | undefined): EmailCategory | null {
  const r = roles ?? []
  if (r.includes('tenant')) return 'tenant'
  if (r.includes('owner') || r.includes('client')) return 'owner'
  if (r.includes('vendor') || r.includes('cleaner')) return 'vendor'
  if (r.includes('manager') || r.includes('employee') || r.includes('admin')) return 'internal'
  return null
}

function propertyFromLease(lease: LeaseLink): { propertyId: string | null; unitId: string | null } {
  const unit = Array.isArray(lease.units) ? lease.units[0] : lease.units
  return {
    propertyId: unit?.property_id ?? null,
    unitId: unit?.id ?? lease.unit_id ?? null,
  }
}

export function classifyByRules(
  message: ParsedGmailMessage,
  peopleByEmail: Map<string, PersonRow>,
  leaseByTenantId: Map<string, { propertyId: string | null; unitId: string | null }>,
): ClassificationResult | null {
  const from = message.fromEmail?.toLowerCase() ?? ''
  const subject = message.subject ?? ''
  const haystack = `${subject}\n${message.snippet}\n${(message.bodyText ?? '').slice(0, 1500)}`

  // Interac e-transfer notifications
  if (
    from === 'notifications@payments.interac.ca' ||
    /interac e-transfer/i.test(subject)
  ) {
    return {
      category: 'etransfer',
      confidence: 0.99,
      classifiedBy: 'rule',
      matchedPersonId: null,
      matchedPropertyId: null,
      matchedUnitId: null,
      metadata: { rule: 'interac' },
    }
  }

  // Known contacts
  if (from) {
    const person = peopleByEmail.get(from)
    if (person) {
      const category = roleToCategory(person.role) ?? 'other'
      const lease = leaseByTenantId.get(person.id)
      return {
        category,
        confidence: 0.95,
        classifiedBy: 'rule',
        matchedPersonId: person.id,
        matchedPropertyId: lease?.propertyId ?? null,
        matchedUnitId: lease?.unitId ?? null,
        metadata: { rule: 'known_contact' },
      }
    }

    const domain = from.split('@')[1] ?? ''
    if (INTERNAL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      return {
        category: 'internal',
        confidence: 0.85,
        classifiedBy: 'rule',
        matchedPersonId: null,
        matchedPropertyId: null,
        matchedUnitId: null,
        metadata: { rule: 'internal_domain' },
      }
    }
  }

  if (SPAM_HINTS.test(haystack) && !peopleByEmail.has(from)) {
    return {
      category: 'spam',
      confidence: 0.7,
      classifiedBy: 'rule',
      matchedPersonId: null,
      matchedPropertyId: null,
      matchedUnitId: null,
      metadata: { rule: 'spam_heuristic' },
    }
  }

  if (INVOICE_HINTS.test(haystack)) {
    return {
      category: 'invoice',
      confidence: 0.75,
      classifiedBy: 'rule',
      matchedPersonId: null,
      matchedPropertyId: null,
      matchedUnitId: null,
      metadata: { rule: 'invoice_heuristic' },
    }
  }

  if (RECEIPT_HINTS.test(haystack)) {
    return {
      category: 'receipt',
      confidence: 0.75,
      classifiedBy: 'rule',
      matchedPersonId: null,
      matchedPropertyId: null,
      matchedUnitId: null,
      metadata: { rule: 'receipt_heuristic' },
    }
  }

  if (MAINTENANCE_HINTS.test(haystack)) {
    return {
      category: 'maintenance',
      confidence: 0.65,
      classifiedBy: 'rule',
      matchedPersonId: null,
      matchedPropertyId: null,
      matchedUnitId: null,
      metadata: { rule: 'maintenance_heuristic' },
    }
  }

  return null
}

type SenderLink = {
  propertyId: string
  unitId: string | null
  personId: string | null
}

function applySenderLink(
  result: ClassificationResult,
  fromEmail: string | null | undefined,
  senderLinks: Map<string, SenderLink>,
): ClassificationResult {
  const from = fromEmail?.toLowerCase() ?? ''
  const link = from ? senderLinks.get(from) : undefined
  if (!link) return result
  return {
    ...result,
    matchedPropertyId: link.propertyId,
    matchedUnitId: link.unitId ?? result.matchedUnitId,
    matchedPersonId: link.personId ?? result.matchedPersonId,
    metadata: { ...(result.metadata ?? {}), sender_link: true },
  }
}

export async function loadClassificationContext(
  orgId: string,
  supabase: SupabaseClient,
): Promise<{
  peopleByEmail: Map<string, PersonRow>
  leaseByTenantId: Map<string, { propertyId: string | null; unitId: string | null }>
  senderLinks: Map<string, SenderLink>
  peopleSummary: string
}> {
  const { data: people } = await supabase
    .from('people')
    .select('id, email, role, first_name, last_name')
    .eq('org_id', orgId)
    .eq('active', true)

  const peopleByEmail = new Map<string, PersonRow>()
  for (const p of (people ?? []) as PersonRow[]) {
    if (p.email) peopleByEmail.set(p.email.toLowerCase(), p)
  }

  const { data: leases } = await supabase
    .from('leases')
    .select('tenant_id, unit_id, units(id, property_id)')
    .eq('org_id', orgId)
    .neq('status', 'expired')

  const leaseByTenantId = new Map<string, { propertyId: string | null; unitId: string | null }>()
  for (const lease of (leases ?? []) as LeaseLink[]) {
    if (!lease.tenant_id) continue
    if (leaseByTenantId.has(lease.tenant_id)) continue
    leaseByTenantId.set(lease.tenant_id, propertyFromLease(lease))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: links } = await (supabase as any)
    .from('email_sender_links')
    .select('email, property_id, unit_id, person_id')
    .eq('org_id', orgId)

  const senderLinks = new Map<string, SenderLink>()
  for (const row of (links ?? []) as {
    email: string
    property_id: string
    unit_id: string | null
    person_id: string | null
  }[]) {
    if (!row.email) continue
    senderLinks.set(row.email.toLowerCase(), {
      propertyId: row.property_id,
      unitId: row.unit_id,
      personId: row.person_id,
    })
  }

  const peopleSummary = ((people ?? []) as PersonRow[])
    .slice(0, 80)
    .map((p) => {
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'
      const roles = (p.role ?? []).join('|')
      return `${name} <${p.email}> [${roles}]`
    })
    .join('\n')

  return { peopleByEmail, leaseByTenantId, senderLinks, peopleSummary }
}

export async function classifyWithAi(
  message: ParsedGmailMessage,
  peopleSummary: string,
  peopleByEmail: Map<string, PersonRow>,
  leaseByTenantId: Map<string, { propertyId: string | null; unitId: string | null }>,
): Promise<ClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      category: 'needs_review',
      confidence: 0.2,
      classifiedBy: 'pending',
      matchedPersonId: null,
      matchedPropertyId: null,
      matchedUnitId: null,
      metadata: { reason: 'missing_anthropic_key' },
    }
  }

  const prompt = `You classify property-management inbox email for Canary PM (Newfoundland/Canada).
Return ONLY compact JSON:
{"category":"...","confidence":0-1,"matched_email":null|"email@x.com","reason":"short"}

Allowed categories: spam, tenant, owner, vendor, invoice, receipt, etransfer, maintenance, internal, other, needs_review.
Prefer needs_review over spam when unsure. Never invent emails.

Known contacts:
${peopleSummary || '(none loaded)'}

From: ${message.fromName ?? ''} <${message.fromEmail ?? ''}>
Subject: ${message.subject}
Snippet: ${message.snippet}
Body excerpt:
${(message.bodyText ?? '').slice(0, 1200)}`

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
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      return {
        category: 'needs_review',
        confidence: 0.2,
        classifiedBy: 'pending',
        matchedPersonId: null,
        matchedPropertyId: null,
        matchedUnitId: null,
        metadata: { reason: 'ai_http_error', status: res.status },
      }
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[]
    }
    const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        category: 'needs_review',
        confidence: 0.3,
        classifiedBy: 'ai',
        matchedPersonId: null,
        matchedPropertyId: null,
        matchedUnitId: null,
        metadata: { reason: 'ai_parse_fail' },
      }
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      category?: string
      confidence?: number
      matched_email?: string | null
      reason?: string
    }

    const allowed: EmailCategory[] = [
      'spam',
      'tenant',
      'owner',
      'vendor',
      'invoice',
      'receipt',
      'etransfer',
      'maintenance',
      'internal',
      'other',
      'needs_review',
    ]
    let category = (allowed.includes(parsed.category as EmailCategory)
      ? parsed.category
      : 'needs_review') as EmailCategory
    let confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5

    // Safety: never auto-spam on low confidence
    if (category === 'spam' && confidence < 0.8) {
      category = 'needs_review'
    }
    if (confidence < 0.45) {
      category = 'needs_review'
    }

    const matchedEmail = parsed.matched_email?.toLowerCase() ?? message.fromEmail
    const person = matchedEmail ? peopleByEmail.get(matchedEmail) : undefined
    const lease = person ? leaseByTenantId.get(person.id) : undefined

    return {
      category,
      confidence,
      classifiedBy: 'ai',
      matchedPersonId: person?.id ?? null,
      matchedPropertyId: lease?.propertyId ?? null,
      matchedUnitId: lease?.unitId ?? null,
      metadata: { reason: parsed.reason ?? null },
    }
  } catch (err) {
    return {
      category: 'needs_review',
      confidence: 0.2,
      classifiedBy: 'pending',
      matchedPersonId: null,
      matchedPropertyId: null,
      matchedUnitId: null,
      metadata: {
        reason: 'ai_exception',
        error: err instanceof Error ? err.message : 'unknown',
      },
    }
  }
}

export async function classifyMessage(
  message: ParsedGmailMessage,
  ctx: {
    peopleByEmail: Map<string, PersonRow>
    leaseByTenantId: Map<string, { propertyId: string | null; unitId: string | null }>
    senderLinks: Map<string, SenderLink>
    peopleSummary: string
  },
): Promise<ClassificationResult> {
  const ruled = classifyByRules(message, ctx.peopleByEmail, ctx.leaseByTenantId)
  const base =
    ruled ??
    (await classifyWithAi(message, ctx.peopleSummary, ctx.peopleByEmail, ctx.leaseByTenantId))
  return applySenderLink(base, message.fromEmail, ctx.senderLinks)
}
