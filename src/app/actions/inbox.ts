'use server'

import { createClient } from '@/lib/supabase/server'
import {
  formatPropertyChipLabel,
  formatPropertyFullLabel,
} from '@/lib/canary/property-ops'
import { syncOrgGmailInbox } from '@/lib/gmail/sync'
import {
  EMAIL_CATEGORIES,
  type EmailCategory,
  type InboxMessage,
  type InboxSyncStatus,
} from '@/lib/gmail/types'

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string }

async function getStaffContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role, first_name, last_name, email')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  const roles = (person.role as unknown as string[]) ?? []
  if (!roles.includes('manager') && !roles.includes('employee') && !roles.includes('admin')) {
    return null
  }
  return { supabase, person }
}

function mapRow(row: Record<string, unknown>): InboxMessage {
  const person = row.people as
    | { first_name: string | null; last_name: string | null; email: string }
    | null
    | undefined
  const property = row.properties as
    | { street_address: string | null; city: string | null }
    | null
    | undefined
  const unit = row.units as { unit_number: string | null } | null | undefined
  const unitNumber = unit?.unit_number ?? null

  const personName = person
    ? [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email
    : null
  const propertyLabel = property
    ? formatPropertyChipLabel(property.street_address, unitNumber)
    : null
  const propertyFullLabel = property
    ? formatPropertyFullLabel(property.street_address, property.city, unitNumber)
    : null

  return {
    id: row.id as string,
    gmailMessageId: row.gmail_message_id as string,
    gmailThreadId: (row.gmail_thread_id as string | null) ?? null,
    fromEmail: (row.from_email as string | null) ?? null,
    fromName: (row.from_name as string | null) ?? null,
    toEmails: (row.to_emails as string[]) ?? [],
    ccEmails: (row.cc_emails as string[]) ?? [],
    subject: (row.subject as string) ?? '',
    snippet: (row.snippet as string) ?? '',
    bodyText: (row.body_text as string | null) ?? null,
    receivedAt: row.received_at as string,
    isUnread: Boolean(row.is_unread),
    isArchived: Boolean(row.is_archived),
    category: row.category as EmailCategory,
    categoryConfidence:
      typeof row.category_confidence === 'number' ? row.category_confidence : null,
    classifiedBy: row.classified_by as InboxMessage['classifiedBy'],
    matchedPersonId: (row.matched_person_id as string | null) ?? null,
    matchedPersonName: personName,
    matchedPropertyId: (row.matched_property_id as string | null) ?? null,
    matchedPropertyLabel: propertyLabel,
    matchedPropertyFullLabel: propertyFullLabel,
    matchedUnitId: (row.matched_unit_id as string | null) ?? null,
  }
}

export async function getInboxSyncStatus(): Promise<InboxSyncStatus> {
  const ctx = await getStaffContext()
  if (!ctx) {
    return { connected: false, lastSyncAt: null, lastSyncError: null, historyId: null }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (ctx.supabase as any)
    .from('organizations')
    .select('gmail_connected_at, gmail_last_sync_at, gmail_last_sync_error, gmail_history_id')
    .eq('id', ctx.person.org_id)
    .single()

  return {
    connected: Boolean(org?.gmail_connected_at),
    lastSyncAt: org?.gmail_last_sync_at ?? null,
    lastSyncError: org?.gmail_last_sync_error ?? null,
    historyId: org?.gmail_history_id ?? null,
  }
}

export async function listInboxMessages(opts?: {
  category?: EmailCategory | 'all' | 'unread' | 'archived'
  limit?: number
}): Promise<InboxMessage[]> {
  const ctx = await getStaffContext()
  if (!ctx) return []

  const limit = Math.min(opts?.limit ?? 100, 200)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (ctx.supabase as any)
    .from('email_messages')
    .select(
      `
      id, gmail_message_id, gmail_thread_id, from_email, from_name, to_emails, cc_emails,
      subject, snippet, body_text, received_at, is_unread, is_archived, category, category_confidence,
      classified_by, matched_person_id, matched_property_id, matched_unit_id,
      people:matched_person_id(first_name, last_name, email),
      properties:matched_property_id(street_address, city),
      units:matched_unit_id(unit_number)
    `,
    )
    .eq('org_id', ctx.person.org_id)
    .eq('is_deleted', false)
    .order('received_at', { ascending: false })
    .limit(limit)

  if (opts?.category === 'archived') {
    query = query.eq('is_archived', true)
  } else {
    query = query.eq('is_archived', false)
    if (opts?.category === 'unread') {
      query = query.eq('is_unread', true)
    } else if (opts?.category && opts.category !== 'all') {
      query = query.eq('category', opts.category)
    }
  }

  // Hide muted senders from active views (still visible in Archived)
  if (opts?.category !== 'archived') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: muted } = await (ctx.supabase as any)
      .from('email_muted_senders')
      .select('email')
      .eq('org_id', ctx.person.org_id)
    const mutedEmails = ((muted ?? []) as { email: string }[])
      .map((r) => r.email.toLowerCase())
      .filter(Boolean)
    if (mutedEmails.length > 0) {
      const list = `(${mutedEmails.map((e) => `"${e.replace(/"/g, '')}"`).join(',')})`
      query = query.not('from_email', 'in', list)
    }
  }

  const { data, error } = await query
  if (error) {
    console.error('[inbox] list failed', error)
    return []
  }

  return ((data ?? []) as Record<string, unknown>[]).map(mapRow)
}

export async function getInboxCategoryCounts(): Promise<Record<string, number>> {
  const ctx = await getStaffContext()
  const empty: Record<string, number> = { all: 0, unread: 0, archived: 0 }
  for (const c of EMAIL_CATEGORIES) empty[c] = 0
  if (!ctx) return empty

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data, error }, mutedRes] = await Promise.all([
    (ctx.supabase as any)
      .from('email_messages')
      .select('category, is_unread, is_archived, from_email, is_deleted')
      .eq('org_id', ctx.person.org_id)
      .eq('is_deleted', false),
    (ctx.supabase as any)
      .from('email_muted_senders')
      .select('email')
      .eq('org_id', ctx.person.org_id),
  ])

  if (error || !data) return empty

  const mutedEmails = new Set(
    ((mutedRes.data ?? []) as { email: string }[]).map((r) => r.email.toLowerCase()),
  )

  const counts = { ...empty }
  for (const row of data as {
    category: string
    is_unread: boolean
    is_archived: boolean
    from_email: string | null
  }[]) {
    const from = row.from_email?.toLowerCase() ?? ''
    const muted = Boolean(from && mutedEmails.has(from))
    if (row.is_archived) {
      counts.archived += 1
      continue
    }
    if (muted) continue
    counts.all += 1
    if (row.is_unread) counts.unread += 1
    if (row.category in counts) counts[row.category] += 1
  }
  return counts
}

export async function syncGmailInbox(): Promise<ActionResult<{ imported: number }>> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  try {
    const result = await syncOrgGmailInbox(ctx.person.org_id, ctx.supabase)
    return { success: true, data: { imported: result.imported } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gmail sync failed.',
    }
  }
}

export async function updateInboxMessageCategory(
  messageId: string,
  category: EmailCategory,
): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Not authorized.' }
  if (!EMAIL_CATEGORIES.includes(category)) {
    return { success: false, error: 'Invalid category.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any)
    .from('email_messages')
    .update({
      category,
      classified_by: 'human',
      category_confidence: 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('org_id', ctx.person.org_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function markInboxMessageRead(
  messageId: string,
  isUnread = false,
): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any)
    .from('email_messages')
    .update({ is_unread: isUnread, updated_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('org_id', ctx.person.org_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function setInboxMessageArchived(
  messageId: string,
  archived = true,
): Promise<ActionResult> {
  return bulkArchiveInboxMessages([messageId], archived)
}

export async function bulkArchiveInboxMessages(
  messageIds: string[],
  archived = true,
): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Not authorized.' }
  const ids = [...new Set(messageIds)].filter(Boolean)
  if (ids.length === 0) return { success: false, error: 'No messages selected.' }

  const patch: Record<string, unknown> = {
    is_archived: archived,
    updated_at: new Date().toISOString(),
  }
  if (archived) patch.is_unread = false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any)
    .from('email_messages')
    .update(patch)
    .in('id', ids)
    .eq('org_id', ctx.person.org_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function bulkDeleteInboxMessages(messageIds: string[]): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Not authorized.' }
  const ids = [...new Set(messageIds)].filter(Boolean)
  if (ids.length === 0) return { success: false, error: 'No messages selected.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any)
    .from('email_messages')
    .update({
      is_deleted: true,
      is_archived: true,
      is_unread: false,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('org_id', ctx.person.org_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function listMutedSenders(): Promise<string[]> {
  const ctx = await getStaffContext()
  if (!ctx) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (ctx.supabase as any)
    .from('email_muted_senders')
    .select('email')
    .eq('org_id', ctx.person.org_id)
    .order('email')
  return ((data ?? []) as { email: string }[]).map((r) => r.email)
}

export async function muteInboxSender(email: string): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Not authorized.' }
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@')) return { success: false, error: 'Invalid email.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any).from('email_muted_senders').upsert(
    { org_id: ctx.person.org_id, email: normalized },
    { onConflict: 'org_id,email' },
  )
  if (error) return { success: false, error: error.message }

  // Hide existing mail from this sender
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (ctx.supabase as any)
    .from('email_messages')
    .update({
      is_archived: true,
      is_unread: false,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', ctx.person.org_id)
    .eq('from_email', normalized)
    .eq('is_deleted', false)

  return { success: true }
}

export async function unmuteInboxSender(email: string): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Not authorized.' }
  const normalized = email.trim().toLowerCase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any)
    .from('email_muted_senders')
    .delete()
    .eq('org_id', ctx.person.org_id)
    .eq('email', normalized)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export type InboxPropertyOption = {
  propertyId: string
  unitId: string
  /** Short street (+ unit) for UI display. */
  label: string
  /** Fuller address for search / tooltips. */
  address: string
}

/** Active properties for sender→property tagging in the inbox. */
export async function listInboxPropertyOptions(): Promise<InboxPropertyOption[]> {
  const ctx = await getStaffContext()
  if (!ctx) return []

  const { data: units, error } = await ctx.supabase
    .from('units')
    .select('id, property_id, unit_number, archived_at, properties!inner(id, street_address, city)')
    .eq('org_id', ctx.person.org_id)
    .is('archived_at', null)
    .order('unit_number', { ascending: true })

  if (error || !units) {
    console.error('[inbox] property options failed', error)
    return []
  }

  const options: InboxPropertyOption[] = []
  for (const u of units as unknown as {
    id: string
    property_id: string
    unit_number: string | null
    properties: { id: string; street_address: string | null; city: string | null } | null
  }[]) {
    if (!u.property_id || !u.properties) continue
    const short =
      formatPropertyChipLabel(u.properties.street_address, u.unit_number) || 'Property'
    const full =
      formatPropertyFullLabel(
        u.properties.street_address,
        u.properties.city,
        u.unit_number,
      ) || short
    options.push({
      propertyId: u.property_id,
      unitId: u.id,
      label: short,
      address: full,
    })
  }
  options.sort((a, b) => a.label.localeCompare(b.label))
  return options
}

/**
 * Link a sender email to a property (and unit). Applies to this message and
 * all other PropOS messages from that sender; future syncs reuse the link.
 */
export async function linkInboxSenderToProperty(opts: {
  email: string
  propertyId: string
  unitId?: string | null
  messageId?: string | null
}): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  const email = opts.email.trim().toLowerCase()
  if (!email.includes('@')) return { success: false, error: 'Invalid sender email.' }
  if (!opts.propertyId) return { success: false, error: 'Choose a property.' }

  // Resolve person if we already know this email
  const { data: person } = await ctx.supabase
    .from('people')
    .select('id')
    .eq('org_id', ctx.person.org_id)
    .ilike('email', email)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: linkError } = await (ctx.supabase as any).from('email_sender_links').upsert(
    {
      org_id: ctx.person.org_id,
      email,
      property_id: opts.propertyId,
      unit_id: opts.unitId ?? null,
      person_id: person?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,email' },
  )
  if (linkError) return { success: false, error: linkError.message }

  // Stamp all messages from this sender
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: stampError } = await (ctx.supabase as any)
    .from('email_messages')
    .update({
      matched_property_id: opts.propertyId,
      matched_unit_id: opts.unitId ?? null,
      matched_person_id: person?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', ctx.person.org_id)
    .eq('from_email', email)
    .eq('is_deleted', false)

  if (stampError) return { success: false, error: stampError.message }

  // If a specific message was open, ensure it's updated even if from_email casing differs
  if (opts.messageId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (ctx.supabase as any)
      .from('email_messages')
      .update({
        matched_property_id: opts.propertyId,
        matched_unit_id: opts.unitId ?? null,
        matched_person_id: person?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.messageId)
      .eq('org_id', ctx.person.org_id)
  }

  return { success: true }
}

export async function clearInboxSenderPropertyLink(email: string): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Not authorized.' }
  const normalized = email.trim().toLowerCase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any)
    .from('email_sender_links')
    .delete()
    .eq('org_id', ctx.person.org_id)
    .eq('email', normalized)

  if (error) return { success: false, error: error.message }

  // Clear property stamps on messages from this sender (keep person match if any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (ctx.supabase as any)
    .from('email_messages')
    .update({
      matched_property_id: null,
      matched_unit_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', ctx.person.org_id)
    .eq('from_email', normalized)
    .eq('is_deleted', false)

  return { success: true }
}
