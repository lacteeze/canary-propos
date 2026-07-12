// src/lib/storage/listing-photos.ts
// Public listing photo URLs for the private org-assets bucket.
// Anon may create signed URLs only for …/properties/{id}/photos/… when the
// property has a published listing (storage_select_anon_listing_photos).

import { createPublicClient } from '@/lib/supabase/public'
import { CARD_PHOTOS } from '@/lib/landing/content'

const SIGNED_TTL_SECONDS = 60 * 60 // 1 hour

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * Batch-sign storage paths for public pages.
 * Preserves input length and order — empty/missing paths stay '' at the same index
 * so callers can map `signed[i]` back to listing `i` safely.
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
    if (isHttpUrl(path)) return path
    return byPath.get(path) ?? ''
  })
}

export async function resolveListingCoverPhoto(
  path: string | null | undefined,
  fallbackIndex = 0
): Promise<string> {
  if (!path?.trim()) return CARD_PHOTOS[fallbackIndex % CARD_PHOTOS.length]
  if (isHttpUrl(path)) return path
  const [signed] = await signListingPhotoPaths([path])
  return signed || CARD_PHOTOS[fallbackIndex % CARD_PHOTOS.length]
}

export async function resolveListingGalleryPhotos(
  paths: string[],
  fallbackIndex = 0
): Promise<{ hero: string; gallery: string[]; all: string[] }> {
  if (!paths.length) {
    const hero = CARD_PHOTOS[fallbackIndex % CARD_PHOTOS.length]
    return { hero, gallery: [], all: [hero] }
  }
  const signed = (await signListingPhotoPaths(paths)).filter(Boolean)
  if (!signed.length) {
    const hero = CARD_PHOTOS[fallbackIndex % CARD_PHOTOS.length]
    return { hero, gallery: [], all: [hero] }
  }
  return { hero: signed[0], gallery: signed.slice(1), all: signed }
}
