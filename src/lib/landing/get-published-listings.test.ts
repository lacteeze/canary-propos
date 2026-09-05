import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const loader = readFileSync('src/lib/landing/get-published-listings.ts', 'utf8')
const viewSql = readFileSync(
  'supabase/migrations/20260905051152_public_units_asking_rent.sql',
  'utf8',
)

function unitsSelectColumns(src: string): string[] {
  const match = src.match(
    /\.from\('public_units'\)\s*\n\s*\.select\('([^']+)'\)/,
  )
  expect(match, 'public_units select string').toBeTruthy()
  return match![1].split(',').map((part) => part.trim()).filter(Boolean)
}

describe('getPublishedListings photo pipeline', () => {
  it('loads public views, then signs preview covers', () => {
    expect(loader).toContain("from('public_units')")
    expect(loader).toContain("from('public_properties')")
    expect(loader).toContain('photo_paths')
    expect(loader).toContain('property_type')
    expect(loader).toContain('resolvedPropertyIds')
    expect(loader).toContain('getListingPhotoPathsByPropertyIds')
    expect(loader).toContain('signOrgAssetPaths')
    expect(loader).toContain("'getPublishedListings'")
    expect(loader).toContain("'preview'")
    expect(loader).toContain('photo: cover')
    expect(loader).toContain('const listings = (listingRows ?? [])')
    expect(loader).not.toContain('const listingRows = listings')
  })

  it('only selects public_units columns that exist on the view', () => {
    const selected = unitsSelectColumns(loader)
    expect(selected).toContain('asking_rent')
    for (const column of selected) {
      expect(viewSql).toContain(`u.${column}`)
    }
  })
})
