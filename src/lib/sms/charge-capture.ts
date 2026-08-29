import { createAdminClient } from '@/lib/supabase/admin'
import {
  computeExpenseBilling,
  DEFAULT_EXPENSE_RATES,
  snapshotExpenseBilling,
  type OrgRates,
} from '@/lib/billing/expense-breakdown'
import { shortPropertyAddress } from '@/lib/addresses/short-property-address'
import { phonesEqual, toE164 } from '@/lib/sms/e164'
import { matchProperties, type PropertyMatch } from '@/lib/sms/match-property'
import { parseChargeNote, type LearnedPhrase } from '@/lib/sms/parse-charge-note'
import { sendChargeCaptureSms } from '@/lib/sms/pingram-send'
import { upsertPhrase } from '@/lib/sms/learn-phrase'
import { isAiGatewayConfigured, gatewayGenerateText } from '@/lib/ai/gateway'

const STAFF_ROLES = new Set(['manager', 'employee', 'admin'])

export type InboundSmsInput = {
  from: string
  to: string
  text: string
  media?: { url: string; contentType?: string }[]
  pingramId: string
}

type DraftRow = {
  id: string
  org_id: string
  person_id: string
  from_phone: string
  status: string
  original_text: string
  property_id: string | null
  candidate_properties: PropertyMatch[]
  category: string | null
  note: string | null
  supplies_cost: number | null
  labour_hours: number | null
  computed: Record<string, number> | null
}

function money(n: number): string {
  return n.toFixed(2)
}

function todayStJohns(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/St_Johns',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function isStaffRole(role: unknown): boolean {
  const roles = Array.isArray(role) ? role : typeof role === 'string' ? [role] : []
  return roles.some((r) => STAFF_ROLES.has(String(r)))
}

function formatDraftSms(input: {
  shortAddress: string
  category: string
  note?: string | null
  suppliesCost: number
  hours: number
  rates: OrgRates
  billing: { suppliesMarkedUp: number; labourAmount: number; subtotal: number; hstAmount: number; total: number }
}): string {
  const noteLine = input.note?.trim() ? ` — ${input.note.trim().slice(0, 80)}` : ''
  return [
    `Draft bill-back for ${input.shortAddress}`,
    `${input.category}${noteLine}`,
    `Supplies $${money(input.suppliesCost)} × 1.30 = $${money(input.billing.suppliesMarkedUp)}`,
    `Labour ${input.hours}h × $${money(input.rates.labourRate)} = $${money(input.billing.labourAmount)}`,
    `Subtotal $${money(input.billing.subtotal)}`,
    `HST 15% $${money(input.billing.hstAmount)}`,
    `Total $${money(input.billing.total)}`,
    'Reply Y to post, N to cancel',
  ].join('\n')
}

async function maybeAiParse(text: string): Promise<{
  suppliesCost?: number
  labourHours?: number
  addressHint?: string
  category?: string
  note?: string
} | null> {
  if (!process.env.AI_GATEWAY_API_KEY?.trim()) return null
  if (!isAiGatewayConfigured()) return null
  try {
    const result = await gatewayGenerateText({
      tag: 'sms-charge-parse',
      prompt: `Extract a property bill-back from this staff SMS as JSON with keys suppliesCost (number), labourHours (number), addressHint (string), category (string), note (string). If a bare dollar amount has no "supplies" word, it is labour dollars at $50/hr, not an owner total. SMS: ${text}`,
      maxOutputTokens: 400,
    })
    const raw = result.text?.match(/\{[\s\S]*\}/)?.[0]
    if (!raw) return null
    return JSON.parse(raw) as {
      suppliesCost?: number
      labourHours?: number
      addressHint?: string
      category?: string
      note?: string
    }
  } catch (err) {
    console.warn('[sms-charge-parse] AI parse failed', err)
    return null
  }
}

/**
 * Handle a verified Pingram SMS_INBOUND event.
 * Business skips (unknown number, empty text) log and return — never throw to the webhook.
 */
export async function handleInboundSms(input: InboundSmsInput): Promise<void> {
  const text = (input.text || '').trim()
  const fromE164 = toE164(input.from || '')
  if (!fromE164 || fromE164 === '+1') return

  const supabase = createAdminClient()

  const { error: idempError } = await supabase.from('pingram_webhook_events').insert({
    pingram_id: input.pingramId,
    event_type: 'SMS_INBOUND',
  })
  if (idempError && (idempError as { code?: string }).code === '23505') return
  if (idempError) {
    console.error('[charge-capture] idempotency insert', idempError)
    return
  }

  if (!text) return

  const { data: peopleRows } = await supabase.from('people').select('id, org_id, phone, role, active').eq('active', true)
  const staff = ((peopleRows as Array<{
    id: string
    org_id: string
    phone: string | null
    role: string[] | string | null
    active: boolean
  }> | null) ?? []).filter((p) => p.active && isStaffRole(p.role) && phonesEqual(p.phone, input.from))

  if (staff.length === 0) return

  const inbound = process.env.PINGRAM_INBOUND_NUMBER?.trim()
  if (inbound && !phonesEqual(input.to, inbound)) {
    // Still identify staff; first matching person wins (no per-org inbox number stored).
  }
  const person = staff[0]
  const orgId = person.org_id

  const { data: org } = await supabase
    .from('organizations')
    .select('expense_markup_rate, expense_labour_rate, expense_hst_rate')
    .eq('id', orgId)
    .single()
  const rates: OrgRates = {
    markupRate: Number(org?.expense_markup_rate ?? DEFAULT_EXPENSE_RATES.markupRate),
    labourRate: Number(org?.expense_labour_rate ?? DEFAULT_EXPENSE_RATES.labourRate),
    hstRate: Number(org?.expense_hst_rate ?? DEFAULT_EXPENSE_RATES.hstRate),
  }

  const { data: openDraft } = await supabase
    .from('sms_charge_drafts')
    .select(
      'id, org_id, person_id, from_phone, status, original_text, property_id, candidate_properties, category, note, supplies_cost, labour_hours, computed'
    )
    .eq('org_id', orgId)
    .eq('from_phone', fromE164)
    .in('status', ['pending_property', 'pending_confirm'])
    .maybeSingle()

  const draft = openDraft as DraftRow | null
  const parsed = parseChargeNote(text, { labourRate: rates.labourRate })

  const sms = (message: string) => sendChargeCaptureSms({ to: fromE164, message })

  if (draft && parsed.kind === 'confirm') {
    if (draft.status === 'pending_property' || !draft.property_id) {
      await sms('Pick a property first (reply 1 or 2).')
      return
    }
    const suppliesCost = Number(draft.supplies_cost ?? 0)
    const labourHours = Number(draft.labour_hours ?? 0)
    const snapshot = snapshotExpenseBilling({
      suppliesCost,
      labourHours,
      rates,
      sourceChannel: 'sms',
    })
    const { data: property } = await supabase
      .from('properties')
      .select('street_address')
      .eq('id', draft.property_id)
      .maybeSingle()
    const { data: inserted, error: expError } = await supabase.from('expenses').insert({
      org_id: orgId,
      property_id: draft.property_id,
      description: [draft.category || 'Maintenance', draft.note].filter(Boolean).join(' — '),
      expense_date: todayStJohns(),
      created_by: person.id,
      staff_notes: draft.note,
      source_sms_text: draft.original_text,
      ...snapshot,
    }).select('id').single()
    if (expError) {
      console.error('[charge-capture] expense insert', expError)
      return
    }
    if (inserted?.id) {
      await supabase.from('expense_receipts').update({ expense_id: inserted.id }).eq('draft_id', draft.id)
    }
    await attachDraftMedia(supabase, {
      orgId,
      draftId: draft.id,
      media: input.media,
    })
    await upsertPhrase(supabase, {
      orgId,
      originalText: draft.original_text,
      category: draft.category,
      typicalHours: labourHours,
      typicalSuppliesCost: suppliesCost,
    })
    await supabase.from('sms_charge_drafts').update({ status: 'posted' }).eq('id', draft.id)
    const short = shortPropertyAddress(property?.street_address) || 'property'
    await sms(`Posted: ${short} total $${money(snapshot.billed_amount)}`)
    return
  }

  if (draft && parsed.kind === 'cancel') {
    await supabase.from('sms_charge_drafts').update({ status: 'cancelled' }).eq('id', draft.id)
    await sms('Cancelled.')
    return
  }

  if (draft && parsed.kind === 'propertyChoice') {
    const idx = (parsed.propertyChoice ?? 0) - 1
    const candidates = Array.isArray(draft.candidate_properties) ? draft.candidate_properties : []
    const chosen = candidates[idx]
    if (!chosen) {
      await sms('Pick a property first (reply 1 or 2).')
      return
    }
    await supabase
      .from('sms_charge_drafts')
      .update({ property_id: chosen.id, status: 'pending_confirm' })
      .eq('id', draft.id)
    await attachDraftMedia(supabase, { orgId, draftId: draft.id, media: input.media })
    const billing = computeExpenseBilling({
      suppliesCost: Number(draft.supplies_cost ?? 0),
      labourHours: Number(draft.labour_hours ?? 0),
      rates,
    })
    await sms(
      formatDraftSms({
        shortAddress: shortPropertyAddress(chosen.street_address) || chosen.street_address,
        category: draft.category || 'Maintenance',
        note: draft.note,
        suppliesCost: Number(draft.supplies_cost ?? 0),
        hours: Number(draft.labour_hours ?? 0),
        rates,
        billing,
      })
    )
    return
  }

  if (parsed.kind === 'ignore' || parsed.kind === 'confirm' || parsed.kind === 'cancel') {
    return
  }

  let suppliesCost = parsed.suppliesCost
  let labourHours = parsed.labourHours
  let addressHint = parsed.addressHint
  let category = parsed.category
  let note = parsed.note

  if (suppliesCost === 0 && labourHours === 0) {
    const { data: phrases } = await supabase
      .from('sms_charge_phrases')
      .select('normalized_phrase, typical_hours, typical_supplies_cost, category')
      .eq('org_id', orgId)
    const overlaid = parseChargeNote(text, {
      labourRate: rates.labourRate,
      phrases: (phrases as LearnedPhrase[] | null) ?? [],
    })
    suppliesCost = overlaid.suppliesCost
    labourHours = overlaid.labourHours
    addressHint = overlaid.addressHint || addressHint
    category = overlaid.category || category
    note = overlaid.note || note
  }

  if (suppliesCost === 0 && labourHours === 0) {
    const ai = await maybeAiParse(text)
    if (ai) {
      if (typeof ai.suppliesCost === 'number') suppliesCost = ai.suppliesCost
      if (typeof ai.labourHours === 'number') labourHours = ai.labourHours
      if (ai.addressHint) addressHint = ai.addressHint
      if (ai.category) category = ai.category
      if (ai.note) note = ai.note
    }
  }

  const { data: propRows } = await supabase
    .from('properties')
    .select('id, street_address')
    .eq('org_id', orgId)
  const properties = (propRows as PropertyMatch[] | null) ?? []
  const matches = matchProperties(addressHint || text, properties)

  const persistDraft = async (fields: Record<string, unknown>) => {
    const payload = {
      org_id: orgId,
      person_id: person.id,
      from_phone: fromE164,
      original_text: text,
      category,
      note,
      supplies_cost: suppliesCost,
      labour_hours: labourHours,
      pingram_message_id: input.pingramId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending_property',
      ...fields,
    }
    if (draft) {
      await supabase.from('sms_charge_drafts').update(payload).eq('id', draft.id)
      return draft.id
    }
    const { data: inserted } = await supabase.from('sms_charge_drafts').insert(payload).select('id').single()
    return (inserted as { id?: string } | null)?.id
  }

  if (matches.length === 0) {
    if (draft) {
      await supabase.from('sms_charge_drafts').update({ status: 'cancelled' }).eq('id', draft.id)
    }
    await sms('No property matched. Include a street number, e.g. 73 Casey.')
    return
  }

  if (matches.length > 1) {
    const draftId = await persistDraft({
      status: 'pending_property',
      property_id: null,
      candidate_properties: matches,
    })
    if (draftId) await attachDraftMedia(supabase, { orgId, draftId, media: input.media })
    const lines = matches.map((m, i) => `${i + 1}) ${shortPropertyAddress(m.street_address) || m.street_address}`)
    await sms(`Reply 1 or 2:\n${lines.join('\n')}`)
    return
  }

  const property = matches[0]
  const billing = computeExpenseBilling({ suppliesCost, labourHours, rates })
  const draftId = await persistDraft({
    status: 'pending_confirm',
    property_id: property.id,
    candidate_properties: matches,
    computed: billing,
  })
  if (draftId) await attachDraftMedia(supabase, { orgId, draftId, media: input.media })
  await sms(
    formatDraftSms({
      shortAddress: shortPropertyAddress(property.street_address) || property.street_address,
      category,
      note,
      suppliesCost,
      hours: labourHours,
      rates,
      billing,
    })
  )
}

const RECEIPT_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}
const MAX_RECEIPT_BYTES = 1.5 * 1024 * 1024

async function attachDraftMedia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  input: {
    orgId: string
    draftId: string
    media?: { url: string; contentType?: string }[]
  }
): Promise<void> {
  if (!input.media?.length || !input.draftId) return
  for (const item of input.media) {
    try {
      const contentType = (item.contentType || '').split(';')[0].trim().toLowerCase()
      const ext = RECEIPT_EXT[contentType]
      if (!ext || !item.url) continue
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10_000)
      const res = await fetch(item.url, { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.byteLength > MAX_RECEIPT_BYTES) continue
      const filename = `${crypto.randomUUID()}.${ext}`
      const storagePath = `${input.orgId}/expense-receipts/${input.draftId}/${filename}`
      const { error: upErr } = await supabase.storage.from('org-assets').upload(storagePath, buf, {
        contentType,
        upsert: false,
      })
      if (upErr) {
        console.warn('[charge-capture] receipt upload', upErr)
        continue
      }
      await supabase.from('expense_receipts').insert({
        org_id: input.orgId,
        draft_id: input.draftId,
        storage_path: storagePath,
        content_type: contentType,
      })
    } catch (err) {
      console.warn('[charge-capture] receipt skip', err)
    }
  }
}
