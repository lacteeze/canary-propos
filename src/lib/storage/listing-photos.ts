// src/lib/storage/listing-photos.ts
// Signed URLs for property listing photos in the private org-assets bucket.
// - Public pages: anon may sign only …/properties/{id}/photos/… when the
//   property has a published listing (storage_select_anon_listing_photos).
// - Authenticated staff: may sign any org asset they can SELECT (storage_select_staff).
// - variant 'preview': Image Transformations (width/quality) for cards/thumbs.
// - variant 'full' (default): untransformed originals for gallery/lightbox.

import { createPublicClient } from '@/lib/supabase/public'

const SIGNED_TTL_SECONDS = 60 * 60 // 1 hour
/** Longer TTL for images embedded in outbound emails (recipients open later). */
const EMAIL_SIGNED_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

// Reuse signed URLs for a window shorter than their TTL. These are listing
// photos (no per-user data), so caching is safe. Two wins:
//  1. Skips the Storage sign round-trip for recently-signed paths.
//  2. Returns a *stable* URL string per path+variant, so repeat views reuse
//     the same signed URL (browser cache) within the TTL window.
const SIGNED_CACHE_TTL_MS = 50 * 60 * 1000 // 50 min (< 1h signed TTL)
/** Drop cache entries this long before the JWT exp claim. */
const SIGNED_EXPIRY_SKEW_MS = 60 * 1000
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

const PREVIEW_TRANSFORM = {
  width: 720,
  quality: 70,
  resize: 'contain' as const,
}

/**
 * Process-level cache for whether `/render/image` signed URLs actually serve.
 * createSignedUrl can succeed even when Image Transformations are off/broken;
 * those render URLs then 404 in the browser. Probe once, then stick to full URLs.
 * null = not probed yet.
 */
let previewTransformsUsable: boolean | null = null

export type ListingPhotoVariant = 'preview' | 'full'

function transformsOptedOut(): boolean {
  const flag = process.env.SUPABASE_IMAGE_TRANSFORMS?.trim().toLowerCase()
  return flag === '0' || flag === 'false' || flag === 'off'
}

function isStorageRenderUrl(url: string): boolean {
  try {
    return new URL(url).pathname.includes('/render/image/')
  } catch {
    return url.includes('/render/image/')
  }
}

async function probeRenderUrl(url: string, logLabel: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (head.ok) return true
    // Some edges reject HEAD; a 1-byte ranged GET is enough to verify render works.
    if (head.status === 405 || head.status === 501) {
      const ranged = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        redirect: 'follow',
      })
      if (ranged.ok || ranged.status === 206) return true
      console.warn(
        `[${logLabel}] preview render probe GET status=${ranged.status}; falling back to full URLs`
      )
      return false
    }
    console.warn(
      `[${logLabel}] preview render probe HEAD status=${head.status}; falling back to full URLs`
    )
    return false
  } catch (err) {
    console.warn(`[${logLabel}] preview render probe error; falling back to full URLs`, err)
    return false
  }
}

async function ensurePreviewTransformsUsable(
  sampleRenderUrl: string,
  logLabel: string
): Promise<boolean> {
  if (previewTransformsUsable != null) return previewTransformsUsable
  previewTransformsUsable = await probeRenderUrl(sampleRenderUrl, logLabel)
  return previewTransformsUsable
}

type SignedUrlRow = { path: string | null; signedUrl: string | null; error?: string | null }

type TransformOptions = {
  width?: number
  quality?: number
  resize?: 'contain' | 'cover' | 'fill'
}

type OrgAssetsBucket = {
  createSignedUrls: (
    paths: string[],
    expiresIn: number
  ) => PromiseLike<{ data: SignedUrlRow[] | null; error: { message: string } | null }>
  createSignedUrl: (
    path: string,
    expiresIn: number,
    options?: { transform?: TransformOptions }
  ) => PromiseLike<{
    data: { signedUrl: string } | null
    error: { message: string } | null
  }>
}

type OrgAssetsSigner = {
  storage: {
    from: (bucket: string) => OrgAssetsBucket
  }
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function cacheKey(path: string, variant: ListingPhotoVariant): string {
  return `${variant}:${path}`
}

/** Read JWT `exp` (ms) from a Supabase storage signed URL, or null if unparseable. */
function signedUrlExpiryMs(url: string): number | null {
  try {
    const token = new URL(url).searchParams.get('token')
    if (!token) return null
    const payload = token.split('.')[1]
    if (!payload) return null
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padLen = (4 - (padded.length % 4)) % 4
    const json = Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8')
    const exp = (JSON.parse(json) as { exp?: unknown }).exp
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

function cacheExpiryForSignedUrl(url: string, now: number): number {
  const jwtExp = signedUrlExpiryMs(url)
  const fromTtl = now + SIGNED_CACHE_TTL_MS
  if (jwtExp == null) return fromTtl
  return Math.min(fromTtl, jwtExp - SIGNED_EXPIRY_SKEW_MS)
}

function readCache(path: string, variant: ListingPhotoVariant, now: number): string | null {
  const key = cacheKey(path, variant)
  const cached = signedUrlCache.get(key)
  if (!cached) return null
  const jwtExp = signedUrlExpiryMs(cached.url)
  const jwtOk = jwtExp == null || jwtExp - SIGNED_EXPIRY_SKEW_MS > now
  if (cached.expiresAt > now && jwtOk) return cached.url
  signedUrlCache.delete(key)
  return null
}

function writeCache(path: string, variant: ListingPhotoVariant, url: string, now: number): boolean {
  const expiresAt = cacheExpiryForSignedUrl(url, now)
  if (expiresAt <= now) return false
  signedUrlCache.set(cacheKey(path, variant), { url, expiresAt })
  return true
}

/**
 * Batch-sign full (untransformed) org-assets paths.
 * Preserves createSignedUrls batch semantics and caches under variant 'full'.
 */
async function signFullPaths(
  uniquePaths: string[],
  supabase: OrgAssetsSigner,
  logLabel: string,
  now: number
): Promise<Map<string, string>> {
  const byPath = new Map<string, string>()
  const toSign: string[] = []

  for (const p of uniquePaths) {
    const cached = readCache(p, 'full', now)
    if (cached) byPath.set(p, cached)
    else toSign.push(p)
  }

  const CHUNK = 100
  for (let i = 0; i < toSign.length; i += CHUNK) {
    const chunk = toSign.slice(i, i + CHUNK)
    const { data, error } = await supabase.storage
      .from('org-assets')
      .createSignedUrls(chunk, SIGNED_TTL_SECONDS)

    if (error || !data) {
      console.error(`[${logLabel}]`, error?.message)
      continue
    }
    for (const row of data) {
      if (!row.path || !row.signedUrl) continue
      if (!writeCache(row.path, 'full', row.signedUrl, now)) {
        console.error(`[${logLabel}] refusing expired signed URL for`, row.path)
        continue
      }
      byPath.set(row.path, row.signedUrl)
    }
  }

  return byPath
}

/**
 * Sign preview (transformed) URLs in parallel. On transform/sign failure, or when
 * `/render/image` URLs 404 (Image Transformations disabled/broken), fall back to
 * full signed URLs so listing cards still render.
 */
async function signPreviewPaths(
  uniquePaths: string[],
  supabase: OrgAssetsSigner,
  logLabel: string,
  now: number
): Promise<Map<string, string>> {
  const byPath = new Map<string, string>()
  const toSign: string[] = []

  for (const p of uniquePaths) {
    const cached = readCache(p, 'preview', now)
    if (cached) byPath.set(p, cached)
    else toSign.push(p)
  }

  if (!toSign.length) return byPath

  // Opt-out / known-broken transforms: skip render signing entirely.
  if (transformsOptedOut() || previewTransformsUsable === false) {
    const full = await signFullPaths(toSign, supabase, logLabel, now)
    for (const path of toSign) {
      const url = full.get(path)
      if (!url) continue
      writeCache(path, 'preview', url, now)
      byPath.set(path, url)
    }
    return byPath
  }

  const bucket = supabase.storage.from('org-assets')
  const results = await Promise.all(
    toSign.map(async (path) => {
      const { data, error } = await bucket.createSignedUrl(path, SIGNED_TTL_SECONDS, {
        transform: PREVIEW_TRANSFORM,
      })
      if (error || !data?.signedUrl) {
        console.warn(
          `[${logLabel}] preview transform failed for ${path}; falling back to full`,
          error?.message
        )
        return { path, url: null as string | null }
      }
      return { path, url: data.signedUrl }
    })
  )

  const fallbackPaths: string[] = []
  const pendingRender: Array<{ path: string; url: string }> = []

  for (const { path, url } of results) {
    if (!url) {
      fallbackPaths.push(path)
      continue
    }
    // Server returns /object/sign when transforms are disabled — already safe.
    if (!isStorageRenderUrl(url)) {
      if (writeCache(path, 'preview', url, now)) byPath.set(path, url)
      else fallbackPaths.push(path)
      continue
    }
    pendingRender.push({ path, url })
  }

  if (pendingRender.length) {
    const sample = pendingRender[0].url
    const usable = await ensurePreviewTransformsUsable(sample, logLabel)
    if (usable) {
      for (const { path, url } of pendingRender) {
        if (writeCache(path, 'preview', url, now)) byPath.set(path, url)
        else fallbackPaths.push(path)
      }
    } else {
      for (const { path } of pendingRender) fallbackPaths.push(path)
    }
  }

  if (fallbackPaths.length) {
    const full = await signFullPaths(fallbackPaths, supabase, logLabel, now)
    for (const path of fallbackPaths) {
      const url = full.get(path)
      if (!url) continue
      // Cache under preview key so we don't thrash transform retries every request.
      writeCache(path, 'preview', url, now)
      byPath.set(path, url)
    }
  }

  return byPath
}

/**
 * Batch-sign org-assets storage paths with a caller-supplied Supabase client.
 * Preserves input length and order — empty/missing paths stay '' at the same index
 * so callers can map `signed[i]` back to listing `i` safely.
 * HTTP(S) URLs are not signed (legacy / external); only storage object paths are.
 *
 * @param variant 'preview' for card/thumb transforms; 'full' (default) for originals.
 */
export async function signOrgAssetPaths(
  paths: Array<string | null | undefined>,
  supabase: OrgAssetsSigner,
  logLabel = 'signOrgAssetPaths',
  variant: ListingPhotoVariant = 'full'
): Promise<string[]> {
  const normalized = paths.map((p) => (p ?? '').trim())
  if (!normalized.some(Boolean)) return normalized.map(() => '')

  const uniquePaths = [
    ...new Set(normalized.filter((p) => p.length > 0 && !isHttpUrl(p))),
  ]

  const now = Date.now()
  const byPath =
    variant === 'preview'
      ? await signPreviewPaths(uniquePaths, supabase, logLabel, now)
      : await signFullPaths(uniquePaths, supabase, logLabel, now)

  return normalized.map((path) => {
    if (!path) return ''
    // Only serve real storage uploads — do not pass through external stock URLs
    if (isHttpUrl(path)) return ''
    return byPath.get(path) ?? ''
  })
}

/**
 * Batch-sign storage paths for public pages (anon client).
 */
export async function signListingPhotoPaths(
  paths: Array<string | null | undefined>,
  variant: ListingPhotoVariant = 'full'
): Promise<string[]> {
  return signOrgAssetPaths(paths, createPublicClient(), 'signListingPhotoPaths', variant)
}

/**
 * Sign cover photos for outbound emails with a longer TTL than browse cards.
 * Does not use the short-lived process cache (email URLs must outlive a session).
 */
export async function signListingPhotoPathsForEmail(
  paths: Array<string | null | undefined>
): Promise<string[]> {
  const normalized = paths.map((p) => (p ?? '').trim())
  if (!normalized.some(Boolean)) return normalized.map(() => '')

  const supabase = createPublicClient()
  const uniquePaths = [
    ...new Set(normalized.filter((p) => p.length > 0 && !isHttpUrl(p))),
  ]
  const byPath = new Map<string, string>()
  const CHUNK = 100

  for (let i = 0; i < uniquePaths.length; i += CHUNK) {
    const chunk = uniquePaths.slice(i, i + CHUNK)
    const { data, error } = await supabase.storage
      .from('org-assets')
      .createSignedUrls(chunk, EMAIL_SIGNED_TTL_SECONDS)

    if (error || !data) {
      console.error('[signListingPhotoPathsForEmail]', error?.message)
      continue
    }
    for (const row of data) {
      if (!row.path || !row.signedUrl) continue
      byPath.set(row.path, row.signedUrl)
    }
  }

  return normalized.map((path) => {
    if (!path || isHttpUrl(path)) return ''
    return byPath.get(path) ?? ''
  })
}

export async function resolveListingCoverPhoto(
  path: string | null | undefined
): Promise<string | null> {
  if (!path?.trim()) return null
  if (isHttpUrl(path)) return null
  // Covers are card/hero thumbs — prefer transformed preview to cut cached egress.
  const [signed] = await signListingPhotoPaths([path], 'preview')
  return signed || null
}

/**
 * Sign gallery paths as preview (thumbnail strip) and full (hero + lightbox).
 * `all` / `gallery` are preview URLs (fallback to full if transform fails).
 * `hero` and `full` are untransformed originals — hero alone is ~viewport-wide
 * and must not use the 720px preview transform.
 * `full` is index-aligned with `all` for hero/lightbox without shipping
 * originals for every strip thumb on first paint.
 */
export async function resolveListingGalleryPhotos(
  paths: string[],
  signer?: OrgAssetsSigner,
): Promise<{ hero: string | null; gallery: string[]; all: string[]; full: string[] }> {
  if (!paths.length) {
    return { hero: null, gallery: [], all: [], full: [] }
  }
  const client = signer ?? createPublicClient()
  const [previews, fulls] = await Promise.all([
    signOrgAssetPaths(paths, client, 'signListingPhotoPaths', 'preview'),
    signOrgAssetPaths(paths, client, 'signListingPhotoPaths', 'full'),
  ])
  const pairs = paths
    .map((_, i) => {
      const preview = previews[i] || fulls[i] || ''
      const full = fulls[i] || previews[i] || ''
      return preview || full ? { preview: preview || full, full: full || preview } : null
    })
    .filter((p): p is { preview: string; full: string } => p != null)

  if (!pairs.length) {
    return { hero: null, gallery: [], all: [], full: [] }
  }
  const all = pairs.map((p) => p.preview)
  const full = pairs.map((p) => p.full)
  return { hero: full[0] ?? null, gallery: all.slice(1), all, full }
}
