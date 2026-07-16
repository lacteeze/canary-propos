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
  const toSign: string[] = []
  for (const p of uniquePaths) {
    const cached = signedUrlCache.get(p)
    if (cached && cached.expiresAt > now) {
      byPath.set(p, cached.url)
    } else {
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
    const expiresAt = now + SIGNED_CACHE_TTL_MS
    for (const row of data) {
      if (row.path && row.signedUrl) {
        byPath.set(row.path, row.signedUrl)
        signedUrlCache.set(row.path, { url: row.signedUrl, expiresAt })
      }
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
