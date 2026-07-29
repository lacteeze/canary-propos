import { describe, it, expect } from 'vitest'
import { isListingUuid, listingPublicHref } from './listing-href'

describe('isListingUuid', () => {
  it('returns true for standard UUID strings', () => {
    expect(isListingUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true)
    expect(isListingUuid('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(true)
  })

  it('returns false for address slugs', () => {
    expect(isListingUuid('151-a-signal-hill-road')).toBe(false)
  })
})

describe('listingPublicHref', () => {
  it('prefers /{slug} when slug is present', () => {
    expect(
      listingPublicHref(
        { id: 'uuid', slug: '151-a-signal-hill-road' },
        '?org=canary',
      ),
    ).toBe('/151-a-signal-hill-road?org=canary')
  })

  it('falls back to /listings/{id} when slug is null', () => {
    expect(
      listingPublicHref({ id: 'uuid', slug: null }, '?org=canary'),
    ).toBe('/listings/uuid?org=canary')
  })
})
