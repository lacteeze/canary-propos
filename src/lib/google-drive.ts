// src/lib/google-drive.ts
// Google Drive OAuth helpers + file list/download for property photo import/sync.
// SERVER ONLY — never import in 'use client' files.
//
// Reuses Gmail OAuth client credentials with a separate Drive redirect URI.
// Required env vars:
//   GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET — same Google OAuth client as Gmail
//   DRIVE_REDIRECT_URI — Must be https://yourdomain.com/api/drive/callback

import { google, type drive_v3 } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DriveListItem } from '@/lib/google-drive-types'

export type { DriveListItem } from '@/lib/google-drive-types'

export const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

export const DRIVE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

const FOLDER_MIME = 'application/vnd.google-apps.folder'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the Drive OAuth redirect URI.
 * Prefer DRIVE_REDIRECT_URI; otherwise derive from GMAIL_REDIRECT_URI
 * (…/api/gmail/callback → …/api/drive/callback) so production works when
 * only the Gmail redirect env is set.
 */
export function resolveDriveRedirectUri(): string {
  const explicit = process.env.DRIVE_REDIRECT_URI?.trim()
  if (explicit) return explicit

  const gmail = process.env.GMAIL_REDIRECT_URI?.trim()
  if (gmail) {
    const derived = gmail.replace(/\/api\/gmail\/callback\/?$/i, '/api/drive/callback')
    if (derived !== gmail) return derived
  }

  throw new Error(
    'DRIVE_REDIRECT_URI is not set. Add it in Vercel (e.g. https://canarypm.ca/api/drive/callback) and register the same URI on the Google OAuth client.',
  )
}

function createOAuth2Client() {
  const clientId = process.env.GMAIL_CLIENT_ID?.trim()
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error(
      'GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET must be set for Google Drive OAuth.',
    )
  }

  return new google.auth.OAuth2(clientId, clientSecret, resolveDriveRedirectUri())
}

export function createDriveClient(accessToken: string): drive_v3.Drive {
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })
  return google.drive({ version: 'v3', auth: oauth2Client })
}

// ---------------------------------------------------------------------------
// getDriveAuthUrl
// ---------------------------------------------------------------------------

export function getDriveAuthUrl(orgId: string): string {
  const oauth2Client = createOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [DRIVE_READONLY_SCOPE],
    prompt: 'consent', // force refresh_token on every connect
    state: orgId,
  })
}

// ---------------------------------------------------------------------------
// exchangeDriveCodeForTokens
// ---------------------------------------------------------------------------

export async function exchangeDriveCodeForTokens(code: string): Promise<{
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
      'No refresh_token returned. The user must reconnect Drive with prompt=consent.',
    )
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600 * 1000,
  }
}

// ---------------------------------------------------------------------------
// refreshDriveTokenIfNeeded
// ---------------------------------------------------------------------------

export async function refreshDriveTokenIfNeeded(
  orgId: string,
  supabase: SupabaseClient,
): Promise<string> {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('drive_access_token, drive_refresh_token, drive_token_expiry')
    .eq('id', orgId)
    .single()

  if (error || !org) {
    throw new Error('Organization not found.')
  }

  if (!org.drive_access_token || !org.drive_refresh_token) {
    throw new Error('Google Drive not connected. Please connect Drive from Settings.')
  }

  const expiryMs: number = org.drive_token_expiry ?? 0

  if (Date.now() < expiryMs - 60_000) {
    return org.drive_access_token
  }

  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: org.drive_refresh_token })

  const { credentials } = await oauth2Client.refreshAccessToken()

  if (!credentials.access_token) {
    throw new Error('Failed to refresh Drive access token.')
  }

  await supabase
    .from('organizations')
    .update({
      drive_access_token: credentials.access_token,
      drive_token_expiry: credentials.expiry_date ?? Date.now() + 3600 * 1000,
    })
    .eq('id', orgId)

  return credentials.access_token
}

// ---------------------------------------------------------------------------
// Browse / download helpers
// ---------------------------------------------------------------------------

/** Escape a value for use inside a Drive `files.list` query string literal. */
function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function mapDriveFile(file: drive_v3.Schema$File): DriveListItem | null {
  if (!file.id || !file.name || !file.mimeType) return null
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    isFolder: file.mimeType === FOLDER_MIME,
    modifiedTime: file.modifiedTime ?? null,
    md5Checksum: file.md5Checksum ?? null,
    size: file.size ? Number(file.size) : null,
    thumbnailLink: file.thumbnailLink ?? null,
  }
}

const DRIVE_BROWSE_MIME_FILTER = `(mimeType = '${FOLDER_MIME}' or mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/webp' or mimeType = 'image/jpg')`

export async function listDriveChildren(
  accessToken: string,
  parentId: string | null = 'root',
): Promise<DriveListItem[]> {
  const drive = createDriveClient(accessToken)
  const parent = parentId && parentId.length > 0 ? parentId : 'root'

  const q = [
    `'${escapeDriveQueryValue(parent)}' in parents`,
    'trashed = false',
    DRIVE_BROWSE_MIME_FILTER,
  ].join(' and ')

  const items: DriveListItem[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q,
      pageSize: 100,
      pageToken,
      fields:
        'nextPageToken, files(id, name, mimeType, modifiedTime, md5Checksum, size, thumbnailLink)',
      orderBy: 'folder,name_natural',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    for (const file of res.data.files ?? []) {
      const mapped = mapDriveFile(file)
      if (mapped) items.push(mapped)
    }

    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return items
}

/**
 * Search Drive by name (contains). Used by the import/link modal so managers
 * can find folders (and images) without scrolling.
 */
export async function searchDriveItems(
  accessToken: string,
  query: string,
  options?: { foldersOnly?: boolean; maxResults?: number },
): Promise<DriveListItem[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const drive = createDriveClient(accessToken)
  const foldersOnly = options?.foldersOnly ?? false
  const maxResults = options?.maxResults ?? 50
  const mimeFilter = foldersOnly
    ? `mimeType = '${FOLDER_MIME}'`
    : DRIVE_BROWSE_MIME_FILTER

  const q = [
    mimeFilter,
    `name contains '${escapeDriveQueryValue(trimmed)}'`,
    'trashed = false',
  ].join(' and ')

  const items: DriveListItem[] = []
  let pageToken: string | undefined

  do {
    const pageSize = Math.min(100, maxResults - items.length)
    if (pageSize <= 0) break

    const res = await drive.files.list({
      q,
      pageSize,
      pageToken,
      fields:
        'nextPageToken, files(id, name, mimeType, modifiedTime, md5Checksum, size, thumbnailLink)',
      orderBy: 'folder,name_natural',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    for (const file of res.data.files ?? []) {
      const mapped = mapDriveFile(file)
      if (mapped) items.push(mapped)
      if (items.length >= maxResults) break
    }

    pageToken =
      items.length >= maxResults
        ? undefined
        : (res.data.nextPageToken ?? undefined)
  } while (pageToken)

  return items
}

export async function listDriveImagesInFolder(
  accessToken: string,
  folderId: string,
): Promise<DriveListItem[]> {
  const children = await listDriveChildren(accessToken, folderId)
  return children.filter(
    (item) => !item.isFolder && DRIVE_IMAGE_MIME_TYPES.has(item.mimeType),
  )
}

export async function getDriveFileMetadata(
  accessToken: string,
  fileId: string,
): Promise<DriveListItem | null> {
  const drive = createDriveClient(accessToken)
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, modifiedTime, md5Checksum, size, thumbnailLink',
    supportsAllDrives: true,
  })

  return mapDriveFile(res.data)
}

export async function downloadDriveFile(
  accessToken: string,
  fileId: string,
): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
  const drive = createDriveClient(accessToken)
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType',
    supportsAllDrives: true,
  })

  const mimeType = meta.data.mimeType ?? 'application/octet-stream'
  const name = meta.data.name ?? fileId

  if (!DRIVE_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported Drive file type: ${mimeType}`)
  }

  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  )

  const buffer = Buffer.from(res.data as ArrayBuffer)
  return { buffer, mimeType, name }
}

export function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}
