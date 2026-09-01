import { describe, expect, it } from 'vitest'
import {
  PUBLIC_SHARE_SITE_NAME,
  publicShareDescription,
  publicShareOgImagePath,
  publicShareTitle,
} from './public-share-metadata'

describe('publicShareTitle', () => {
  it('uses the street before the first comma', () => {
    expect(publicShareTitle("92 Barnes Rd, St. John's, NL A1A 1A1")).toBe('92 Barnes Rd')
  })

  it('falls back to a short listing title, then Canary PM', () => {
    expect(publicShareTitle(null, "12 Water St, St. John's")).toBe('12 Water St')
    expect(publicShareTitle('  ', '  ')).toBe(PUBLIC_SHARE_SITE_NAME)
    expect(publicShareTitle(null, null)).toBe(PUBLIC_SHARE_SITE_NAME)
  })
})

describe('publicShareDescription', () => {
  it('prefers the listing description excerpt', () => {
    expect(
      publicShareDescription({
        city: "St. John's",
        listingDescription: 'Bright two-bedroom near Quidi Vidi.',
      }),
    ).toBe('Bright two-bedroom near Quidi Vidi.')
  })

  it('falls back to city copy', () => {
    expect(publicShareDescription({ city: "St. John's" })).toBe(
      `Rental in St. John's — ${PUBLIC_SHARE_SITE_NAME}`,
    )
  })
})

describe('publicShareOgImagePath', () => {
  it('is scoped to the property id so crawlers cannot mix listings', () => {
    expect(publicShareOgImagePath('prop-92')).toBe('/api/og/property/prop-92')
  })
})
