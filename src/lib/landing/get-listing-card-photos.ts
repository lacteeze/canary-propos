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
    .select('id, status, unit_id')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()

  if (error || !listing) {
    if (error) console.error('[getListingCardPhotos]', error.message)
    return []
  }

  if (!listing.unit_id) return []
  const { data: unit } = await supabase
    .from('public_units')
    .select('property_id')
    .eq('id', listing.unit_id)
    .maybeSingle()
  const propertyId = unit?.property_id
  if (!propertyId) return []
  const { data: property } = await supabase
    .from('public_properties')
    .select('id, photo_paths')
    .eq('id', propertyId)
    .maybeSingle()
  if (!property?.id) return []

  const fromMedia = await getListingPhotoPathsForProperty(propertyId)
  const fromLegacy = (property?.photo_paths ?? []).filter(
    (p): p is string => !!p && !/^https?:\/\//i.test(p)
  )
  const paths = fromMedia.length ? fromMedia : fromLegacy
  if (!paths.length) return []

  return (await signListingPhotoPaths(paths, 'preview')).filter(Boolean)
}
