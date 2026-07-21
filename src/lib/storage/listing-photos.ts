// src/lib/storage/listing-photos.ts
// Signed URLs for property listing photos in the private org-assets bucket.
// - Public pages: anon may sign only …/properties/{id}/photos/… when the
//   property has a published listing (storage_select_anon_listing_photos).
// - Authenticated staff: may sign any org asset they can SELECT (storage_select_staff).

import { createPublicClient } from '@/lib/supabase/public'

const SIGNED_TTL_SECONDS = 60 * 60 // 1 hour

// Reuse signed URLs for a window shorter than their TTL. These are listing
// photos (no per-user data), so caching is safe. Two wins:
//  1. Skips the Storage sign round-trip for recently-signed paths.
//  2. Returns a *stable* URL string per path, so a cover shown on the landing
//     card and the hero on the detail page resolve to the identical URL — the
//     browser reuses the already-downloaded image (near-instant hero).
const SIGNED_CACHE_TTL_MS = 50 * 60 * 1000 // 50 min (< 1h signed TTL)
/** Drop cache entries this long before the JWT exp claim. */
const SIGNED_EXPIRY_SKEW_MS = 60 * 1000
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

type SignedUrlRow = { path: string | null; signedUrl: string | null; error?: string | null }

type OrgAssetsSigner = {
  storage: {
    from: (bucket: string) => {
      createSignedUrls: (
        paths: string[],
        expiresIn: number
      ) => PromiseLike<{ data: SignedUrlRow[] | null; error: { message: string } | null }>
    }
  }
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
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

/**
 * Batch-sign org-assets storage paths with a caller-supplied Supabase client.
 * Preserves input length and order — empty/missing paths stay '' at the same index
 * so callers can map `signed[i]` back to listing `i` safely.
 * HTTP(S) URLs are not signed (legacy / external); only storage object paths are.
 */
export async function signOrgAssetPaths(
  paths: Array<string | null | undefined>,
  supabase: OrgAssetsSigner,
  logLabel = 'signOrgAssetPaths'
): Promise<string[]> {
  const normalized = paths.map((p) => (p ?? '').trim())
  if (!normalized.some(Boolean)) return normalized.map(() => '')

  const uniquePaths = [
    ...new Set(normalized.filter((p) => p.length > 0 && !isHttpUrl(p))),
  ]

  const byPath = new Map<string, string>()
  const now = Date.now()

  // Serve cached signatures first; only sign the paths we don't already have.
  // Drop entries past local TTL *or* whose JWT exp has lapsed — Next.js may
  // replay a cached createSignedUrls response into this Map with a fresh local
  // TTL, which would otherwise keep serving dead tokens for ~50 minutes.
  const toSign: string[] = []
  for (const p of uniquePaths) {
    const cached = signedUrlCache.get(p)
    const jwtExp = cached ? signedUrlExpiryMs(cached.url) : null
    const jwtOk = jwtExp == null || jwtExp - SIGNED_EXPIRY_SKEW_MS > now
    if (cached && cached.expiresAt > now && jwtOk) {
      byPath.set(p, cached.url)
    } else {
      if (cached) signedUrlCache.delete(p)
      toSign.push(p)
    }
  }

  // Chunk to stay within Storage API batch limits on large portfolios.
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
      const expiresAt = cacheExpiryForSignedUrl(row.signedUrl, now)
      // Refuse to cache or return tokens that are already past usable life.
      if (expiresAt <= now) {
        console.error(`[${logLabel}] refusing expired signed URL for`, row.path)
        continue
      }
      byPath.set(row.path, row.signedUrl)
      signedUrlCache.set(row.path, { url: row.signedUrl, expiresAt })
    }
  }

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
  paths: Array<string | null | undefined>
): Promise<string[]> {
  return signOrgAssetPaths(paths, createPublicClient(), 'signListingPhotoPaths')
}

export async function resolveListingCoverPhoto(
  path: string | null | undefined
): Promise<string | null> {
  if (!path?.trim()) return null
  if (isHttpUrl(path)) return null
  const [signed] = await signListingPhotoPaths([path])
  return signed || null
}

export async function resolveListingGalleryPhotos(
  paths: string[]
): Promise<{ hero: string | null; gallery: string[]; all: string[] }> {
  if (!paths.length) {
    return { hero: null, gallery: [], all: [] }
  }
  const signed = (await signListingPhotoPaths(paths)).filter(Boolean)
  if (!signed.length) {
    return { hero: null, gallery: [], all: [] }
  }
  return { hero: signed[0], gallery: signed.slice(1), all: signed }
}
