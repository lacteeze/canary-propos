export const EMAIL_CATEGORIES = [
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
] as const

export type EmailCategory = (typeof EMAIL_CATEGORIES)[number]

export type EmailClassifiedBy = 'rule' | 'ai' | 'human' | 'pending'

export type ParsedGmailMessage = {
  gmailMessageId: string
  gmailThreadId: string | null
  fromEmail: string | null
  fromName: string | null
  toEmails: string[]
  ccEmails: string[]
  subject: string
  snippet: string
  bodyText: string | null
  receivedAt: string
  isUnread: boolean
  labelIds: string[]
}

export type ClassificationResult = {
  category: EmailCategory
  confidence: number
  classifiedBy: EmailClassifiedBy
  matchedPersonId: string | null
  matchedPropertyId: string | null
  matchedUnitId: string | null
  metadata?: Record<string, unknown>
}

export type InboxMessage = {
  id: string
  gmailMessageId: string
  gmailThreadId: string | null
  fromEmail: string | null
  fromName: string | null
  toEmails: string[]
  ccEmails: string[]
  subject: string
  snippet: string
  bodyText: string | null
  receivedAt: string
  isUnread: boolean
  isArchived: boolean
  category: EmailCategory
  categoryConfidence: number | null
  classifiedBy: EmailClassifiedBy
  matchedPersonId: string | null
  matchedPersonName: string | null
  matchedPropertyId: string | null
  /** Short street (+ unit) for chips, e.g. "12 Pennywell Rd · 10A". */
  matchedPropertyLabel: string | null
  /** Fuller address for chip tooltips. */
  matchedPropertyFullLabel: string | null
  matchedUnitId: string | null
}

export type InboxSyncStatus = {
  connected: boolean
  lastSyncAt: string | null
  lastSyncError: string | null
  historyId: string | null
}
