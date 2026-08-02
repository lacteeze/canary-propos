import { describe, expect, it } from 'vitest'
import {
  appendLearnedListingBriefOptions,
  collectNewListingBriefOptions,
  mergeListingBriefOptions,
  parseListingBrief,
  syncPetsIntoAmenities,
} from './listing-brief'

describe('listing-brief options', () => {
  it('merges defaults with learned custom values', () => {
    const merged = mergeListingBriefOptions({
      pets: ['Cats OK with deposit', 'No pets'],
      utilities: ['Heat included + wifi'],
    })
    expect(merged.pets).toContain('No pets')
    expect(merged.pets).toContain('Cats OK with deposit')
    expect(merged.pets.filter((v) => v.toLowerCase() === 'no pets')).toHaveLength(1)
    expect(merged.utilities).toContain('Heat included + wifi')
  })

  it('collects only novel brief values', () => {
    const current = mergeListingBriefOptions({})
    const additions = collectNewListingBriefOptions(
      parseListingBrief({ pets: 'Cats OK with deposit', utilities: 'Utilities included' }),
      current
    )
    expect(additions.pets).toEqual(['Cats OK with deposit'])
    expect(additions.utilities).toBeUndefined()
  })

  it('stores only learned (non-default) options', () => {
    const next = appendLearnedListingBriefOptions({}, { pets: ['Cats OK with deposit', 'No pets'] })
    expect(next.pets).toEqual(['Cats OK with deposit'])
  })
})

describe('syncPetsIntoAmenities', () => {
  it('replaces pet amenity tags from listing_brief.pets', () => {
    expect(syncPetsIntoAmenities(['Garage', 'Pet friendly'], 'Cats OK')).toEqual([
      'Garage',
      'Cats OK',
    ])
    expect(syncPetsIntoAmenities(['Garage', 'Dog friendly'], 'No pets')).toEqual(['Garage'])
    expect(syncPetsIntoAmenities(['Garage'], '')).toEqual(['Garage'])
  })
})
