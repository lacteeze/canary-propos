import { unstable_cache } from 'next/cache'
import { fetchListedProperties } from '@/lib/hospitable/client'
import { mapPropertiesToStays } from '@/lib/hospitable/map-property-to-stay'
import { getDefaultStays, type LandingStay } from './content'

const fetchCachedListedProperties = unstable_cache(
  async () => fetchListedProperties(),
  ['hospitable-listed-properties'],
  { revalidate: 3600, tags: ['hospitable-stays'] }
)

export async function getHospitableStays(): Promise<LandingStay[]> {
  if (!process.env.HOSPITABLE_API_PAT?.trim()) {
    return getDefaultStays()
  }

  try {
    const properties = await fetchCachedListedProperties()
    const stays = mapPropertiesToStays(properties)
    return stays.length > 0 ? stays : getDefaultStays()
  } catch (error) {
    console.error('[getHospitableStays] Falling back to default stays:', error)
    return getDefaultStays()
  }
}
