import { google } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import { refreshTokenIfNeeded } from '@/lib/gmail'
import { classifyMessage, loadClassificationContext } from './classify'
import { parseGmailMessage } from './parse'
import type { ParsedGmailMessage } from './types'

const BACKFILL_DAYS = 45
const MAX_MESSAGES_PER_SYNC = 40

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI,
  )
}

async function fetchFullMessage(
  gmail: ReturnType<typeof google.gmail>,
  id: string,
): Promise<ParsedGmailMessage | null> {
  const detail = await gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'full',
  })
  return parseGmailMessage(detail.data)
}

async function upsertClassifiedMessage(
  orgId: string,
  supabase: SupabaseClient,
  parsed: ParsedGmailMessage,
  ctx: Awaited<ReturnType<typeof loadClassificationContext>>,
  mutedEmails: Set<string>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('email_messages')
    .select('id, is_deleted, is_archived, classified_by')
    .eq('org_id', orgId)
    .eq('gmail_message_id', parsed.gmailMessageId)
    .maybeSingle()

  if (existing?.is_deleted) return

  const from = parsed.fromEmail?.toLowerCase() ?? ''
  const muted = Boolean(from && mutedEmails.has(from))
  const classification = await classifyMessage(parsed, ctx)

  // Don't overwrite human category choices on re-sync
  const keepHuman = existing?.classified_by === 'human'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('email_messages').upsert(
    {
      org_id: orgId,
      gmail_message_id: parsed.gmailMessageId,
      gmail_thread_id: parsed.gmailThreadId,
      from_email: parsed.fromEmail,
      from_name: parsed.fromName,
      to_emails: parsed.toEmails,
      cc_emails: parsed.ccEmails,
      subject: parsed.subject,
      snippet: parsed.snippet,
      body_text: parsed.bodyText,
      received_at: parsed.receivedAt,
      is_unread: muted || existing?.is_archived ? false : parsed.isUnread,
      gmail_label_ids: parsed.labelIds,
      ...(keepHuman
        ? {}
        : {
            category: classification.category,
            category_confidence: classification.confidence,
            classified_by: classification.classifiedBy,
            matched_person_id: classification.matchedPersonId,
            matched_property_id: classification.matchedPropertyId,
            matched_unit_id: classification.matchedUnitId,
            metadata: classification.metadata ?? {},
          }),
      ...(muted || existing?.is_archived ? { is_archived: true } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,gmail_message_id' },
  )

  if (error) {
    throw new Error(error.message ?? 'Failed to upsert email message')
  }
}

export type SyncResult = {
  imported: number
  historyId: string | null
  lastSyncAt: string
}

export async function syncOrgGmailInbox(
  orgId: string,
  supabase: SupabaseClient,
): Promise<SyncResult> {
  const accessToken = await refreshTokenIfNeeded(orgId, supabase)
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('gmail_history_id')
    .eq('id', orgId)
    .single()

  const classifyCtx = await loadClassificationContext(orgId, supabase)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mutedRows } = await (supabase as any)
    .from('email_muted_senders')
    .select('email')
    .eq('org_id', orgId)
  const mutedEmails = new Set<string>(
    ((mutedRows ?? []) as { email: string }[]).map((r) => r.email.toLowerCase()),
  )
  const messageIds = new Set<string>()
  let newestHistoryId: string | null = org?.gmail_history_id ?? null

  try {
    const profile = await gmail.users.getProfile({ userId: 'me' })
    newestHistoryId = profile.data.historyId ?? newestHistoryId

    if (org?.gmail_history_id) {
      try {
        const history = await gmail.users.history.list({
          userId: 'me',
          startHistoryId: org.gmail_history_id,
          historyTypes: ['messageAdded'],
          maxResults: 100,
        })
        for (const h of history.data.history ?? []) {
          for (const added of h.messagesAdded ?? []) {
            if (added.message?.id) messageIds.add(added.message.id)
          }
        }
        if (history.data.historyId) newestHistoryId = history.data.historyId
      } catch {
        // Invalid/expired historyId — fall through to date backfill
        messageIds.clear()
      }
    }

    if (messageIds.size === 0) {
      const after = new Date()
      after.setDate(after.getDate() - BACKFILL_DAYS)
      const y = after.getFullYear()
      const m = String(after.getMonth() + 1).padStart(2, '0')
      const d = String(after.getDate()).padStart(2, '0')
      const list = await gmail.users.messages.list({
        userId: 'me',
        q: `after:${y}/${m}/${d}`,
        maxResults: MAX_MESSAGES_PER_SYNC,
      })
      for (const msg of list.data.messages ?? []) {
        if (msg.id) messageIds.add(msg.id)
      }
    }

    const ids = [...messageIds].slice(0, MAX_MESSAGES_PER_SYNC)
    let imported = 0

    for (const id of ids) {
      try {
        const parsed = await fetchFullMessage(gmail, id)
        if (!parsed) continue
        await upsertClassifiedMessage(orgId, supabase, parsed, classifyCtx, mutedEmails)
        imported += 1
      } catch (err) {
        console.error('[gmail-sync] message failed', id, err)
      }
    }

    const lastSyncAt = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('organizations')
      .update({
        gmail_history_id: newestHistoryId,
        gmail_last_sync_at: lastSyncAt,
        gmail_last_sync_error: null,
      })
      .eq('id', orgId)

    return { imported, historyId: newestHistoryId, lastSyncAt }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gmail sync failed'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('organizations')
      .update({ gmail_last_sync_error: message })
      .eq('id', orgId)
    throw err
  }
}
