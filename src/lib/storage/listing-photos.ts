// src/lib/storage/listing-photos.ts
// Public listing photo URLs for the private org-assets bucket.
// Anon may create signed URLs only for …/properties/{id}/photos/… when the
// property has a published listing (storage_select_anon_listing_photos).

import { createPublicClient } from '@/lib/supabase/public'

const SIGNED_TTL_SECONDS = 60 * 60 // 1 hour

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * Batch-sign storage paths for public pages.
 * Preserves input length and order — empty/missing paths stay '' at the same index
 * so callers can map `signed[i]` back to listing `i` safely.
 * HTTP(S) URLs are not signed (legacy / external); only storage object paths are.
 */
export async function signListingPhotoPaths(
  paths: Array<string | null | undefined>
): Promise<string[]> {
  const normalized = paths.map((p) => (p ?? '').trim())
  if (!normalized.some(Boolean)) return normalized.map(() => '')

  const storagePaths = [
    ...new Set(normalized.filter((p) => p.length > 0 && !isHttpUrl(p))),
  ]

  const byPath = new Map<string, string>()
  if (storagePaths.length) {
    const supabase = createPublicClient()
    const { data, error } = await supabase.storage
      .from('org-assets')
      .createSignedUrls(storagePaths, SIGNED_TTL_SECONDS)

    if (error || !data) {
      console.error('[signListingPhotoPaths]', error?.message)
    } else {
      for (const row of data) {
        if (row.path && row.signedUrl) byPath.set(row.path, row.signedUrl)
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
