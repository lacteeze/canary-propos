import { STAY_PHOTOS } from '@/lib/landing/content'
import type { LandingStay } from '@/lib/landing/content'
import type { HospitableProperty } from './client'

export const DEFAULT_STAYS_HREF = 'https://airbnb.ca/p/canarypm'

function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return Number.isInteger(value) ? String(value) : String(value)
}

/** Prefer a sharper remote Hospitable/Airbnb picture when no PropOS cover exists. */
export function upgradeHospitablePictureUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.hostname.endsWith('muscache.com') && parsed.searchParams.get('aki_policy') === 'small') {
      parsed.searchParams.set('aki_policy', 'large')
      return parsed.toString()
    }
  } catch {
    // fall through
  }

  // Hospitable CDN thumbs: …/thumb-xyz.jpg → try non-thumb sibling
  if (/\/thumb-[^/]+$/i.test(trimmed)) {
    return trimmed.replace(/\/thumb-/i, '/')
  }

  return trimmed
}

export function mapPropertyToStay(
  property: HospitableProperty,
  photoFallbackIndex = 0,
  photoOverride?: string | null,
  hrefOverride?: string | null
): LandingStay | null {
  const short = (property.public_name || property.name || '').trim()
  const town = (property.address?.city || '').trim()
  if (!short || !town) return null

  const beds = formatCount(property.capacity?.bedrooms)
  const baths = formatCount(property.capacity?.bathrooms)
  const maxGuests = property.capacity?.max
  const sleeps =
    maxGuests != null && !Number.isNaN(maxGuests) ? formatCount(maxGuests) : ''

  // Prefer PropOS public property page (equal treatment with listings); fall back to
  // Hospitable site URL / Airbnb portfolio only when no slug match exists.
  const siteUrl = property.bookings?.site_urls?.find(Boolean)
  const href = hrefOverride?.trim() || siteUrl?.trim() || DEFAULT_STAYS_HREF
  const photo =
    photoOverride?.trim() ||
    upgradeHospitablePictureUrl(property.picture) ||
    STAY_PHOTOS[photoFallbackIndex % STAY_PHOTOS.length]

  return { short, town, beds, baths, sleeps, extra: '', photo, href }
}

export function mapPropertiesToStays(
  properties: HospitableProperty[],
  photoOverrides?: Map<string, string>,
  hrefOverrides?: Map<string, string>
): LandingStay[] {
  return properties
    .map((property, index) =>
      mapPropertyToStay(
        property,
        index,
        photoOverrides?.get(property.id),
        hrefOverrides?.get(property.id)
      )
    )
    .filter((stay): stay is LandingStay => stay != null)
}
