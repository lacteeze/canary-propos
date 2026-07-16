import { STAY_PHOTOS } from '@/lib/landing/content'
import type { LandingStay } from '@/lib/landing/content'
import type { HospitableProperty } from './client'

export const DEFAULT_STAYS_HREF = 'https://airbnb.ca/p/canarypm'

function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return Number.isInteger(value) ? String(value) : String(value)
}

export function mapPropertyToStay(
  property: HospitableProperty,
  photoFallbackIndex = 0
): LandingStay | null {
  const short = (property.public_name || property.name || '').trim()
  const town = (property.address?.city || '').trim()
  if (!short || !town) return null

  const beds = formatCount(property.capacity?.bedrooms)
  const baths = formatCount(property.capacity?.bathrooms)
  const maxGuests = property.capacity?.max
  const sleeps =
    maxGuests != null && !Number.isNaN(maxGuests) ? formatCount(maxGuests) : ''

  const siteUrl = property.bookings?.site_urls?.find(Boolean)
  const href = siteUrl?.trim() || DEFAULT_STAYS_HREF
  const photo =
    property.picture?.trim() ||
    STAY_PHOTOS[photoFallbackIndex % STAY_PHOTOS.length]

  return { short, town, beds, baths, sleeps, extra: '', photo, href }
}

export function mapPropertiesToStays(properties: HospitableProperty[]): LandingStay[] {
  return properties
    .map((property, index) => mapPropertyToStay(property, index))
    .filter((stay): stay is LandingStay => stay != null)
}
