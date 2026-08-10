import { unstable_cache } from 'next/cache'
import { fetchListedProperties } from '@/lib/hospitable/client'
import { mapPropertiesToStays } from '@/lib/hospitable/map-property-to-stay'
import { propertyPublicHref } from '@/lib/listings/listing-href'
import { getDefaultStays, type LandingStay } from './content'
import {
  loadStayCoverLookup,
  resolveStaySlug,
  signStayCoverOverrides,
} from './stay-cover-photos'

const fetchCachedListedProperties = unstable_cache(
  async () => fetchListedProperties(),
  ['hospitable-listed-properties'],
  { revalidate: 3600, tags: ['hospitable-stays'] }
)

export async function getHospitableStays(
  orgSlug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? 'canary'
): Promise<LandingStay[]> {
  if (!process.env.HOSPITABLE_API_PAT?.trim()) {
    return getDefaultStays()
  }

  try {
    const properties = await fetchCachedListedProperties()
    // Prefer PropOS listing covers (signed preview transforms) when we can
    // match a Hospitable property to a slugged property with uploaded photos.
    // Hospitable `picture` is often an Airbnb aki_policy=small or CDN thumb.
    const lookup = await loadStayCoverLookup(orgSlug)
    const photoOverrides = await signStayCoverOverrides(properties, lookup)
    const orgQuery = orgSlug ? `?org=${orgSlug}` : ''
    const hrefOverrides = new Map<string, string>()
    for (const property of properties) {
      const slug = resolveStaySlug(property, lookup)
      const href = propertyPublicHref({ slug }, { orgQuery })
      if (href) hrefOverrides.set(property.id, href)
    }
    const stays = mapPropertiesToStays(properties, photoOverrides, hrefOverrides)
    return stays.length > 0 ? stays : getDefaultStays()
  } catch (error) {
    console.error('[getHospitableStays] Falling back to default stays:', error)
    return getDefaultStays()
  }
}
