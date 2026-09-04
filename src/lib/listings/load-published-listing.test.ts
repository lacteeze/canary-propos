import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assembleListingDetail, type PublishedListingRow } from './load-published-listing'

const listing: PublishedListingRow = {
  id: 'listing-1',
  org_id: 'org-1',
  unit_id: 'unit-1',
  slug: '92-barnes-rd',
  listing_title: '92 Barnes Rd',
  listing_description: 'Bright two-bedroom',
  highlights: ['Long-term'],
  display_rent: 1800,
  available_from: '2026-09-30',
  available_until: null,
  status: 'published',
}

describe('assembleListingDetail', () => {
  it('keeps a published listing listed with unit and property data', () => {
    const assembled = assembleListingDetail(
      listing,
      {
        id: 'unit-1',
        property_id: 'prop-1',
        bedrooms: 2,
        bathrooms: 1,
        sq_footage: 900,
        amenities: ['Garage'],
        status: 'occupied',
        asking_rent: 1750,
        hospitable_widget_property_id: null,
      },
      {
        id: 'prop-1',
        street_address: "92 Barnes Rd, St. John's",
        city: "St. John's",
        province: 'NL',
        photo_paths: ['org/properties/prop-1/photos/cover.jpg'],
        listing_brief: { parking: '1' },
      },
    )

    expect(assembled.status).toBe('published')
    expect(assembled.units?.status).toBe('occupied')
    expect(assembled.units?.asking_rent).toBe(1750)
    expect(assembled.units?.properties?.id).toBe('prop-1')
    expect(assembled.units?.properties?.photo_paths).toHaveLength(1)
  })

  it('still returns the listing when the public unit/property views are empty', () => {
    const assembled = assembleListingDetail(listing, null, null)
    expect(assembled.id).toBe('listing-1')
    expect(assembled.status).toBe('published')
    expect(assembled.units).toBeNull()
  })
})

describe('published listing loaders', () => {
  it('do not embed units or properties tables (column grants break PostgREST joins)', () => {
    const src = readFileSync('src/lib/listings/load-published-listing.ts', 'utf8')
    const page = readFileSync('src/lib/listings/public-slug-page.tsx', 'utf8')
    expect(src).not.toMatch(/units\s*\(/)
    expect(src).not.toMatch(/properties\s*\(/)
    expect(src).toContain("from('public_units')")
    expect(src).toContain("from('public_properties')")
    expect(page).not.toContain('LISTING_DETAIL_SELECT')
    expect(page).toContain("from '@/lib/listings/load-published-listing'")
  })
})
