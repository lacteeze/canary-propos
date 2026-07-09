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

/** Batch-sign storage paths for public pages. Falls back to empty string on failure. */
export async function signListingPhotoPaths(
  paths: Array<string | null | undefined>
): Promise<string[]> {
  const cleaned = paths.map((p) => (p ?? '').trim()).filter(Boolean)
  if (!cleaned.length) return []

  const absolute = cleaned.filter(isHttpUrl)
  const storagePaths = cleaned.filter((p) => !isHttpUrl(p))
  if (!storagePaths.length) return absolute

  const supabase = createPublicClient()
  const { data, error } = await supabase.storage
    .from('org-assets')
    .createSignedUrls(storagePaths, SIGNED_TTL_SECONDS)

  if (error || !data) {
    console.error('[signListingPhotoPaths]', error?.message)
    return absolute
  }

  const byPath = new Map(
    data
      .filter((row) => row.path && row.signedUrl)
      .map((row) => [row.path as string, row.signedUrl as string])
  )

  return cleaned
    .map((path) => (isHttpUrl(path) ? path : byPath.get(path) ?? ''))
    .filter(Boolean)
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
): Promise<{ hero: string; gallery: string[] }> {
  if (!paths.length) {
    return { hero: CARD_PHOTOS[fallbackIndex % CARD_PHOTOS.length], gallery: [] }
  }
  const signed = await signListingPhotoPaths(paths)
  if (!signed.length) {
    return { hero: CARD_PHOTOS[fallbackIndex % CARD_PHOTOS.length], gallery: [] }
  }
  return { hero: signed[0], gallery: signed.slice(1, 5) }
}
