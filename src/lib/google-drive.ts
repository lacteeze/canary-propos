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
import type { DriveFolderListing, DriveListItem } from '@/lib/google-drive-types'

export type { DriveFolderListing, DriveListItem } from '@/lib/google-drive-types'

export const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

export const DRIVE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut'

/** Max folder depth below the linked root when collecting images for sync (0 = root only). */
export const DRIVE_IMAGE_SYNC_MAX_DEPTH = 2

const LIST_FIELDS =
  'nextPageToken, files(id, name, mimeType, modifiedTime, md5Checksum, size, thumbnailLink, shortcutDetails(targetId, targetMimeType))'

const FILE_FIELDS =
  'id, name, mimeType, modifiedTime, md5Checksum, size, thumbnailLink, shortcutDetails(targetId, targetMimeType)'

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

export function isDriveImageMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false
  return DRIVE_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())
}

function mapDriveFile(
  file: drive_v3.Schema$File,
  opts?: { resolvedFromShortcut?: boolean },
): DriveListItem | null {
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
    resolvedFromShortcut: opts?.resolvedFromShortcut,
  }
}

async function listRawChildren(
  drive: drive_v3.Drive,
  parentId: string,
): Promise<drive_v3.Schema$File[]> {
  const parent = parentId && parentId.length > 0 ? parentId : 'root'
  const q = [
    `'${escapeDriveQueryValue(parent)}' in parents`,
    'trashed = false',
  ].join(' and ')

  const files: drive_v3.Schema$File[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q,
      pageSize: 100,
      pageToken,
      fields: LIST_FIELDS,
      orderBy: 'folder,name_natural',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    for (const file of res.data.files ?? []) {
      files.push(file)
    }

    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return files
}

/**
 * Resolve a shortcut file to its image target when possible.
 * Returns null when the target is missing or not a supported image.
 */
async function resolveShortcutToImage(
  drive: drive_v3.Drive,
  shortcut: drive_v3.Schema$File,
): Promise<DriveListItem | null> {
  const targetId = shortcut.shortcutDetails?.targetId
  const targetMime = shortcut.shortcutDetails?.targetMimeType ?? null
  if (!targetId) return null

  // Fast path: API already told us the target mime type
  if (targetMime && !isDriveImageMime(targetMime) && targetMime !== FOLDER_MIME) {
    return null
  }
  if (targetMime === FOLDER_MIME) return null

  try {
    const res = await drive.files.get({
      fileId: targetId,
      fields: FILE_FIELDS,
      supportsAllDrives: true,
    })
    const mapped = mapDriveFile(res.data, { resolvedFromShortcut: true })
    if (!mapped || mapped.isFolder || !isDriveImageMime(mapped.mimeType)) {
      return null
    }
    // Keep the shortcut's display name when present
    if (shortcut.name) mapped.name = shortcut.name
    return mapped
  } catch {
    return null
  }
}

type ClassifiedChildren = {
  folders: DriveListItem[]
  images: DriveListItem[]
  unsupportedFileCount: number
  totalChildCount: number
}

async function classifyChildren(
  drive: drive_v3.Drive,
  raw: drive_v3.Schema$File[],
): Promise<ClassifiedChildren> {
  const folders: DriveListItem[] = []
  const images: DriveListItem[] = []
  let unsupportedFileCount = 0
  const seenImageIds = new Set<string>()

  const shortcuts: drive_v3.Schema$File[] = []

  for (const file of raw) {
    if (!file.id || !file.mimeType) {
      unsupportedFileCount += 1
      continue
    }

    if (file.mimeType === FOLDER_MIME) {
      const mapped = mapDriveFile(file)
      if (mapped) folders.push(mapped)
      continue
    }

    if (file.mimeType === SHORTCUT_MIME) {
      shortcuts.push(file)
      continue
    }

    if (isDriveImageMime(file.mimeType)) {
      const mapped = mapDriveFile(file)
      if (mapped && !seenImageIds.has(mapped.id)) {
        seenImageIds.add(mapped.id)
        images.push(mapped)
      }
      continue
    }

    unsupportedFileCount += 1
  }

  // Resolve shortcuts in small parallel batches
  const BATCH = 8
  for (let i = 0; i < shortcuts.length; i += BATCH) {
    const batch = shortcuts.slice(i, i + BATCH)
    const resolved = await Promise.all(
      batch.map((s) => resolveShortcutToImage(drive, s)),
    )
    for (let j = 0; j < resolved.length; j++) {
      const item = resolved[j]
      if (item && !seenImageIds.has(item.id)) {
        seenImageIds.add(item.id)
        images.push(item)
      } else if (!item) {
        unsupportedFileCount += 1
      }
    }
  }

  return {
    folders,
    images,
    unsupportedFileCount,
    totalChildCount: raw.length,
  }
}

/**
 * List folders + supported images in a Drive folder (direct children only).
 * Resolves image shortcuts. Does not mime-filter the Drive query so HEIC and
 * other types are visible to classification (empty-state diagnostics).
 */
export async function listDriveChildren(
  accessToken: string,
  parentId: string | null = 'root',
): Promise<DriveListItem[]> {
  const listing = await listDriveFolderListing(accessToken, parentId)
  return listing.items
}

/** Full browse payload with empty-state counters. */
export async function listDriveFolderListing(
  accessToken: string,
  parentId: string | null = 'root',
): Promise<DriveFolderListing> {
  const drive = createDriveClient(accessToken)
  const parent = parentId && parentId.length > 0 ? parentId : 'root'
  const raw = await listRawChildren(drive, parent)
  const classified = await classifyChildren(drive, raw)
  const items = [...classified.folders, ...classified.images]

  return {
    items,
    folderId: parent,
    totalChildCount: classified.totalChildCount,
    unsupportedFileCount: classified.unsupportedFileCount,
    imageCount: classified.images.length,
    folderCount: classified.folders.length,
  }
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

  // Broader query: folders, common images, HEIC/HEIF/GIF, and shortcuts.
  // Classification drops non-image shortcuts after resolve.
  const mimeFilter = foldersOnly
    ? `mimeType = '${FOLDER_MIME}'`
    : `(mimeType = '${FOLDER_MIME}' or mimeType contains 'image/' or mimeType = '${SHORTCUT_MIME}')`

  const q = [
    mimeFilter,
    `name contains '${escapeDriveQueryValue(trimmed)}'`,
    'trashed = false',
  ].join(' and ')

  const raw: drive_v3.Schema$File[] = []
  let pageToken: string | undefined

  do {
    const pageSize = Math.min(100, Math.max(maxResults * 2 - raw.length, 10))
    if (raw.length >= maxResults * 2) break

    const res = await drive.files.list({
      q,
      pageSize,
      pageToken,
      fields: LIST_FIELDS,
      orderBy: 'folder,name_natural',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    for (const file of res.data.files ?? []) {
      raw.push(file)
    }

    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  if (foldersOnly) {
    const folders: DriveListItem[] = []
    for (const file of raw) {
      const mapped = mapDriveFile(file)
      if (mapped?.isFolder) folders.push(mapped)
      if (folders.length >= maxResults) break
    }
    return folders
  }

  const classified = await classifyChildren(drive, raw)
  return [...classified.folders, ...classified.images].slice(0, maxResults)
}

/**
 * Collect supported images under a folder, including nested folders up to
 * `maxDepth` levels below the root (default 2 — covers typical Photos/ subfolders).
 */
export async function listDriveImagesInFolder(
  accessToken: string,
  folderId: string,
  options?: { maxDepth?: number },
): Promise<DriveListItem[]> {
  const maxDepth = options?.maxDepth ?? DRIVE_IMAGE_SYNC_MAX_DEPTH
  const drive = createDriveClient(accessToken)
  const images: DriveListItem[] = []
  const seenImageIds = new Set<string>()

  type QueueItem = { id: string; depth: number }
  const queue: QueueItem[] = [{ id: folderId, depth: 0 }]
  const visitedFolders = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visitedFolders.has(current.id)) continue
    visitedFolders.add(current.id)

    const raw = await listRawChildren(drive, current.id)
    const classified = await classifyChildren(drive, raw)

    for (const img of classified.images) {
      if (!seenImageIds.has(img.id)) {
        seenImageIds.add(img.id)
        images.push(img)
      }
    }

    if (current.depth < maxDepth) {
      for (const folder of classified.folders) {
        if (!visitedFolders.has(folder.id)) {
          queue.push({ id: folder.id, depth: current.depth + 1 })
        }
      }
    }
  }

  return images
}

export async function getDriveFileMetadata(
  accessToken: string,
  fileId: string,
): Promise<DriveListItem | null> {
  const drive = createDriveClient(accessToken)
  const res = await drive.files.get({
    fileId,
    fields: FILE_FIELDS,
    supportsAllDrives: true,
  })

  if (res.data.mimeType === SHORTCUT_MIME) {
    return resolveShortcutToImage(drive, res.data)
  }

  const mapped = mapDriveFile(res.data)
  if (!mapped) return null
  if (!mapped.isFolder && !isDriveImageMime(mapped.mimeType)) return null
  return mapped
}

export async function downloadDriveFile(
  accessToken: string,
  fileId: string,
): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
  const drive = createDriveClient(accessToken)
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, shortcutDetails(targetId, targetMimeType)',
    supportsAllDrives: true,
  })

  let targetId = fileId
  let mimeType = meta.data.mimeType ?? 'application/octet-stream'
  let name = meta.data.name ?? fileId

  if (mimeType === SHORTCUT_MIME) {
    const resolved = await resolveShortcutToImage(drive, meta.data)
    if (!resolved) {
      throw new Error('Drive shortcut does not point to a supported image.')
    }
    targetId = resolved.id
    mimeType = resolved.mimeType
    name = resolved.name
  }

  if (!isDriveImageMime(mimeType)) {
    throw new Error(`Unsupported Drive file type: ${mimeType}`)
  }

  const res = await drive.files.get(
    { fileId: targetId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  )

  const buffer = Buffer.from(res.data as ArrayBuffer)
  return { buffer, mimeType, name }
}

/** Fetch a Drive thumbnail bytes for the authenticated proxy. */
export async function fetchDriveThumbnail(
  accessToken: string,
  fileId: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const drive = createDriveClient(accessToken)
  const meta = await drive.files.get({
    fileId,
    fields: 'id, mimeType, thumbnailLink, shortcutDetails(targetId, targetMimeType)',
    supportsAllDrives: true,
  })

  let targetId = fileId
  if (meta.data.mimeType === SHORTCUT_MIME) {
    const target = meta.data.shortcutDetails?.targetId
    if (!target) return null
    targetId = target
  }

  const thumbMeta =
    targetId === fileId
      ? meta
      : await drive.files.get({
          fileId: targetId,
          fields: 'thumbnailLink',
          supportsAllDrives: true,
        })

  const thumbnailLink = thumbMeta.data.thumbnailLink
  if (!thumbnailLink) return null

  // thumbnailLink is often usable with the OAuth token; try with auth first.
  const headers: HeadersInit = { Authorization: `Bearer ${accessToken}` }
  let res = await fetch(thumbnailLink, { headers })
  if (!res.ok) {
    // Some googleusercontent URLs reject Authorization — retry without.
    res = await fetch(thumbnailLink)
  }
  if (!res.ok) return null

  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer, contentType }
}

export function extensionForMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase()
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/webp') return 'webp'
  if (normalized === 'image/gif') return 'gif'
  if (normalized === 'image/heic') return 'heic'
  if (normalized === 'image/heif') return 'heif'
  return 'jpg'
}
