// src/lib/gmail.ts
// Gmail OAuth helpers + Interac e-transfer search (PAY-03)
// SERVER ONLY — never import in 'use client' files.
//
// INSTALL NOTE: requires `googleapis` package.
// Run: cd canary-propos && npm install googleapis
// Verify package is legitimate before installing: https://www.npmjs.com/package/googleapis
//
// Required env vars:
//   GMAIL_CLIENT_ID      — Google OAuth2 client ID
//   GMAIL_CLIENT_SECRET  — Google OAuth2 client secret
//   GMAIL_REDIRECT_URI   — Must be https://yourdomain.com/api/gmail/callback

import { google } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrgIntegration, upsertOrgIntegration } from '@/lib/org-integrations'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI,
  )
}

// ---------------------------------------------------------------------------
// getGmailAuthUrl
// Returns the Google OAuth consent URL. `state` is a CSRF nonce (not an org id).
// ---------------------------------------------------------------------------

export function getGmailAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://mail.google.com/'],
    prompt: 'consent', // force refresh_token on every connect
    state,
  })
}

// ---------------------------------------------------------------------------
// exchangeCodeForTokens
// Exchanges the one-time authorization code Google returns to /api/gmail/callback
// for long-lived access + refresh tokens.
// Throws if refresh_token is missing (user must reconnect with prompt=consent).
// ---------------------------------------------------------------------------

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expiry_date: number
}> {
  const oauth2Client = createOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)

  if (!tokens.access_token) {
    throw new Error('No access_token returned from Google OAuth.')
  }
  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh_token returned. The user must reconnect Gmail with prompt=consent.',
    )
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600 * 1000,
  }
}

// ---------------------------------------------------------------------------
// refreshTokenIfNeeded
// Reads the org's stored tokens, refreshes the access_token if it is expired
// or within 60 seconds of expiry, updates the DB, and returns a valid access_token.
// ---------------------------------------------------------------------------

export async function refreshTokenIfNeeded(
  orgId: string,
  _supabase: SupabaseClient,
): Promise<string> {
  const row = await getOrgIntegration(orgId, 'gmail')

  if (!row?.access_token || !row.refresh_token) {
    throw new Error('Gmail not connected. Please connect Gmail from Settings.')
  }

  const expiryMs: number = row.token_expiry ?? 0

  if (Date.now() < expiryMs - 60_000) {
    return row.access_token
  }

  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: row.refresh_token })

  const { credentials } = await oauth2Client.refreshAccessToken()

  if (!credentials.access_token) {
    throw new Error('Failed to refresh Gmail access token.')
  }

  const tokenExpiry = credentials.expiry_date ?? Date.now() + 3600 * 1000
  await upsertOrgIntegration(orgId, 'gmail', {
    access_token: credentials.access_token,
    refresh_token: row.refresh_token,
    token_expiry: tokenExpiry,
  })

  return credentials.access_token
}

// ---------------------------------------------------------------------------
// ETransferSuggestion type
// ---------------------------------------------------------------------------

export interface ETransferSuggestion {
  messageId: string
  senderName: string
  amount: number
  receivedAt: string // ISO 8601
  subject: string
}

// ---------------------------------------------------------------------------
// searchETransfers
// Searches the connected Gmail inbox for Interac e-transfer notifications and
// returns parsed suggestions. Suggestions only — no auto-confirmation logic.
// ---------------------------------------------------------------------------

export async function searchETransfers(
  accessToken: string,
): Promise<ETransferSuggestion[]> {
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:notifications@payments.interac.ca subject:"INTERAC e-Transfer"',
    maxResults: 50,
  })

  const messages = listResponse.data.messages ?? []
  const suggestions: ETransferSuggestion[] = []

  for (const msg of messages) {
    if (!msg.id) continue

    try {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'Date'],
      })

      const headers = detail.data.payload?.headers ?? []
      const subject = headers.find((h) => h.name === 'Subject')?.value ?? ''
      const internalDateMs = parseInt(detail.data.internalDate ?? '0', 10)

      // Parse sender name: "John Smith sent you $500.00 via INTERAC e-Transfer"
      const nameMatch = subject.match(/^(.+?)\s+sent you/i)
      if (!nameMatch) continue

      const senderName = nameMatch[1].trim()

      // Parse amount from subject
      const amountMatch = subject.match(/\$([0-9,]+\.[0-9]{2})/)
      if (!amountMatch) continue

      const amount = parseFloat(amountMatch[1].replace(/,/g, ''))
      if (isNaN(amount)) continue

      const receivedAt = new Date(internalDateMs).toISOString()

      suggestions.push({
        messageId: msg.id,
        senderName,
        amount,
        receivedAt,
        subject,
      })
    } catch {
      // Skip messages that fail to parse — do not crash the whole batch
      continue
    }
  }

  return suggestions
}
