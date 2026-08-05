// src/lib/google-tasks.ts
// Google Tasks OAuth helpers + list/import incomplete tasks.
// SERVER ONLY — never import in 'use client' files.
//
// Reuses Gmail OAuth client credentials with a separate Tasks redirect URI.
// Required env vars:
//   GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET — same Google OAuth client as Gmail
//   TASKS_REDIRECT_URI — Must be https://yourdomain.com/api/google-tasks/callback
//     (optional; derived from GMAIL_REDIRECT_URI when omitted)

import { google, type tasks_v1 } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'

export const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks'

export type GoogleTaskListItem = {
  id: string
  title: string
  notes: string | null
  due: string | null
  status: string | null
  taskListId: string
  taskListTitle: string
}

/**
 * Prefer TASKS_REDIRECT_URI; otherwise derive from GMAIL_REDIRECT_URI
 * (…/api/gmail/callback → …/api/google-tasks/callback).
 */
export function resolveTasksRedirectUri(): string {
  const explicit = process.env.TASKS_REDIRECT_URI?.trim()
  if (explicit) return explicit

  const gmail = process.env.GMAIL_REDIRECT_URI?.trim()
  if (gmail) {
    const derived = gmail.replace(/\/api\/gmail\/callback\/?$/i, '/api/google-tasks/callback')
    if (derived !== gmail) return derived
  }

  throw new Error(
    'TASKS_REDIRECT_URI is not set. Add it in Vercel (e.g. https://canarypm.ca/api/google-tasks/callback) and register the same URI on the Google OAuth client.',
  )
}

function createOAuth2Client() {
  const clientId = process.env.GMAIL_CLIENT_ID?.trim()
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error(
      'GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET must be set for Google Tasks OAuth.',
    )
  }

  return new google.auth.OAuth2(clientId, clientSecret, resolveTasksRedirectUri())
}

export function createTasksClient(accessToken: string): tasks_v1.Tasks {
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })
  return google.tasks({ version: 'v1', auth: oauth2Client })
}

export function getTasksAuthUrl(orgId: string): string {
  const oauth2Client = createOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [TASKS_SCOPE],
    prompt: 'consent',
    state: orgId,
  })
}

export async function exchangeTasksCodeForTokens(code: string): Promise<{
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
      'No refresh_token returned. The user must reconnect Google Tasks with prompt=consent.',
    )
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600 * 1000,
  }
}

export async function refreshTasksTokenIfNeeded(
  orgId: string,
  supabase: SupabaseClient,
): Promise<string> {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('tasks_access_token, tasks_refresh_token, tasks_token_expiry')
    .eq('id', orgId)
    .single()

  if (error || !org) {
    throw new Error('Organization not found.')
  }

  if (!org.tasks_access_token || !org.tasks_refresh_token) {
    throw new Error('Google Tasks not connected. Please connect Google Tasks from Settings.')
  }

  const expiryMs: number = org.tasks_token_expiry ?? 0

  if (Date.now() < expiryMs - 60_000) {
    return org.tasks_access_token
  }

  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: org.tasks_refresh_token })

  const { credentials } = await oauth2Client.refreshAccessToken()

  if (!credentials.access_token) {
    throw new Error('Failed to refresh Google Tasks access token.')
  }

  await supabase
    .from('organizations')
    .update({
      tasks_access_token: credentials.access_token,
      tasks_token_expiry: credentials.expiry_date ?? Date.now() + 3600 * 1000,
    })
    .eq('id', orgId)

  return credentials.access_token
}

/** Fetch incomplete tasks across all task lists (MVP import source). */
export async function listIncompleteGoogleTasks(
  accessToken: string,
): Promise<GoogleTaskListItem[]> {
  const tasksApi = createTasksClient(accessToken)
  const listsRes = await tasksApi.tasklists.list({ maxResults: 100 })
  const lists = listsRes.data.items ?? []
  const out: GoogleTaskListItem[] = []

  for (const list of lists) {
    if (!list.id) continue
    let pageToken: string | undefined
    do {
      const res = await tasksApi.tasks.list({
        tasklist: list.id,
        showCompleted: false,
        showHidden: false,
        maxResults: 100,
        pageToken,
      })
      for (const t of res.data.items ?? []) {
        if (!t.id || !t.title) continue
        if (t.status === 'completed') continue
        // Google due is RFC3339 date/time; store date portion when present
        const dueRaw = t.due ?? null
        const due = dueRaw ? dueRaw.slice(0, 10) : null
        out.push({
          id: t.id,
          title: t.title,
          notes: t.notes ?? null,
          due,
          status: t.status ?? null,
          taskListId: list.id,
          taskListTitle: list.title ?? 'Tasks',
        })
      }
      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)
  }

  return out
}
