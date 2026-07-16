import { createPublicClient } from '@/lib/supabase/public'
import { getListingPhotoPathsForProperty } from '@/lib/storage/property-listing-media'
import { signListingPhotoPaths } from '@/lib/storage/listing-photos'

/**
 * Signed photo URLs for a published listing card carousel (cover first).
 * Used on-demand when the user advances past the cover on a browse card.
 */
export async function getListingCardPhotos(listingId: string): Promise<string[]> {
  const id = listingId?.trim()
  if (!id) return []

  const supabase = createPublicClient()
  const { data: listing, error } = await supabase
    .from('listings')
    .select(
      `id, status,
       units!unit_id(properties!property_id(id, photo_paths))`
    )
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()

  if (error || !listing) {
    if (error) console.error('[getListingCardPhotos]', error.message)
    return []
  }

  const unit = listing.units as {
    properties?: { id?: string; photo_paths?: string[] | null } | null
  } | null
  const property = unit?.properties
  const propertyId = property?.id
  if (!propertyId) return []

  const fromMedia = await getListingPhotoPathsForProperty(propertyId)
  const fromLegacy = (property?.photo_paths ?? []).filter(
    (p): p is string => !!p && !/^https?:\/\//i.test(p)
  )
  const paths = fromMedia.length ? fromMedia : fromLegacy
  if (!paths.length) return []

  return (await signListingPhotoPaths(paths)).filter(Boolean)
}
