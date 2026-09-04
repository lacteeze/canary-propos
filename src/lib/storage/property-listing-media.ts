// src/lib/storage/property-listing-media.ts
// Fetch listing-visibility photo paths for public pages (property_media).

import { publicPropertyLookupClient } from '@/lib/listings/public-property-lookup'

/** Listing photo paths for a property, ordered. Empty if none / not readable. */
export async function getListingPhotoPathsForProperty(
  propertyId: string,
  // Service-role lookup when anon RLS hides marketed-home media after column grants.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: { from: (table: string) => any },
): Promise<string[]> {
  const supabase = client ?? publicPropertyLookupClient()
  const { data, error } = await supabase
    .from('property_media')
    .select('storage_path, sort_order')
    .eq('property_id', propertyId)
    .eq('visibility', 'listing')
    .order('sort_order', { ascending: true })
    .limit(100)

  if (error) {
    console.error('[getListingPhotoPathsForProperty]', error.message)
    return []
  }

  return (data ?? []).map((r: { storage_path: string }) => r.storage_path).filter(Boolean)
}

/** Batch: property_id → ordered listing photo paths */
export async function getListingPhotoPathsByPropertyIds(
  propertyIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  const ids = [...new Set(propertyIds.filter(Boolean))]
  if (!ids.length) return map

  const supabase = publicPropertyLookupClient()
  const { data, error } = await supabase
    .from('property_media')
    .select('property_id, storage_path, sort_order')
    .in('property_id', ids)
    .eq('visibility', 'listing')
    .order('sort_order', { ascending: true })
    .limit(3000)

  if (error) {
    console.error('[getListingPhotoPathsByPropertyIds]', error.message)
    return map
  }

  for (const row of data ?? []) {
    const list = map.get(row.property_id) ?? []
    list.push(row.storage_path)
    map.set(row.property_id, list)
  }
  return map
}
