import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leased public URL lookup', () => {
  it('does not call optional RPCs that 404 when the migration is not applied', () => {
    const page = readFileSync('src/lib/listings/public-slug-page.tsx', 'utf8')
    const lookup = readFileSync('src/lib/listings/public-property-lookup.ts', 'utf8')
    const forbidden = [
      'public_property_is_leased',
      'public_property_id_for_slug',
      'public_property_id_for_listing',
    ]
    for (const name of forbidden) {
      expect(page).not.toContain(name)
      expect(lookup).not.toContain(name)
    }
    expect(lookup).not.toMatch(/\.rpc\(/)
    expect(page).not.toMatch(/\.rpc\(/)
  })

  it('signs and reads listing photos with the service-role lookup client', () => {
    const media = readFileSync('src/lib/storage/property-listing-media.ts', 'utf8')
    const photos = readFileSync('src/lib/storage/listing-photos.ts', 'utf8')
    expect(media).toContain('publicPropertyLookupClient')
    expect(photos).toContain('publicPropertyLookupClient')
    expect(media).not.toContain('createPublicClient')
    expect(photos).not.toContain('createPublicClient')
  })

  it('does not hide published listing details because the unit is occupied', () => {
    const page = readFileSync('src/lib/listings/public-slug-page.tsx', 'utf8')
    const start = page.indexOf('export function listingIsPubliclyAvailable')
    const end = page.indexOf('export async function renderPublishedListingPage')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const fn = page.slice(start, end)
    expect(fn).toContain('publishedListingIsListed')
    expect(fn).not.toContain('unitLooksLeased')
    expect(fn).not.toContain('publicPropertyIsLeased')
  })
})
