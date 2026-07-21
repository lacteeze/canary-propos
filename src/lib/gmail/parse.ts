import type { gmail_v1 } from 'googleapis'
import type { ParsedGmailMessage } from './types'

function headerValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  const lower = name.toLowerCase()
  return headers?.find((h) => (h.name ?? '').toLowerCase() === lower)?.value ?? ''
}

function decodeBodyData(data?: string | null): string {
  if (!data) return ''
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return Buffer.from(normalized, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function collectParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  out: { text: string[]; html: string[] },
): void {
  if (!part) return
  const mime = (part.mimeType ?? '').toLowerCase()
  if (mime === 'text/plain' && part.body?.data) {
    out.text.push(decodeBodyData(part.body.data))
  } else if (mime === 'text/html' && part.body?.data) {
    out.html.push(decodeBodyData(part.body.data))
  }
  for (const child of part.parts ?? []) {
    collectParts(child, out)
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function parseEmailAddressList(raw: string): string[] {
  if (!raw.trim()) return []
  const matches = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []
  return [...new Set(matches.map((e) => e.toLowerCase()))]
}

export function parseFromHeader(raw: string): { email: string | null; name: string | null } {
  const emailMatch = raw.match(/<([^>]+)>/)
  const email = (emailMatch?.[1] ?? raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null)
    ?.trim()
    .toLowerCase() ?? null
  let name: string | null = null
  if (emailMatch) {
    name = raw.replace(emailMatch[0], '').replace(/^"|"$/g, '').trim() || null
  }
  return { email, name }
}

export function parseGmailMessage(message: gmail_v1.Schema$Message): ParsedGmailMessage | null {
  if (!message.id) return null

  const headers = message.payload?.headers
  const fromRaw = headerValue(headers, 'From')
  const { email: fromEmail, name: fromName } = parseFromHeader(fromRaw)
  const toEmails = parseEmailAddressList(headerValue(headers, 'To'))
  const ccEmails = parseEmailAddressList(headerValue(headers, 'Cc'))
  const subject = headerValue(headers, 'Subject')
  const collected = { text: [] as string[], html: [] as string[] }
  collectParts(message.payload, collected)
  const bodyText =
    collected.text.join('\n\n').trim() ||
    (collected.html[0] ? htmlToText(collected.html[0]) : null)
  const internalDateMs = parseInt(message.internalDate ?? '0', 10)
  const labelIds = message.labelIds ?? []

  return {
    gmailMessageId: message.id,
    gmailThreadId: message.threadId ?? null,
    fromEmail,
    fromName,
    toEmails,
    ccEmails,
    subject,
    snippet: message.snippet ?? '',
    bodyText: bodyText ? bodyText.slice(0, 20_000) : null,
    receivedAt: new Date(internalDateMs || Date.now()).toISOString(),
    isUnread: labelIds.includes('UNREAD'),
    labelIds,
  }
}
