import { describe, expect, it } from 'vitest'
import {
  appendLearnedListingBriefOptions,
  collectNewListingBriefOptions,
  listingBriefToPromptLines,
  mergeListingBriefOptions,
  parseListingBrief,
  removeLearnedListingBriefOption,
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
      parseListingBrief({
        pets: 'Cats OK with deposit',
        utilities: 'Utilities included',
        features: ['Bay window', 'Hardwood floors'],
      }),
      current
    )
    expect(additions.pets).toEqual(['Cats OK with deposit'])
    expect(additions.utilities).toBeUndefined()
    expect(additions.features).toEqual(['Bay window'])
  })

  it('stores only learned (non-default) options', () => {
    const next = appendLearnedListingBriefOptions({}, { pets: ['Cats OK with deposit', 'No pets'] })
    expect(next.pets).toEqual(['Cats OK with deposit'])
  })

  it('removes custom-learned options without touching defaults', () => {
    const stored = appendLearnedListingBriefOptions(
      {},
      { features: ['Bay window', 'Fenced yard'] }
    )
    const next = removeLearnedListingBriefOption(stored, 'features', 'Bay window')
    expect(next.features).toEqual(['Fenced yard'])
    const merged = mergeListingBriefOptions(next)
    expect(merged.features).toContain('Hardwood floors')
    expect(merged.features).not.toContain('Bay window')
  })
})

describe('parseListingBrief features', () => {
  it('parses features as string[]', () => {
    const brief = parseListingBrief({ features: ['Hardwood floors', 'Yard access'] })
    expect(brief.features).toEqual(['Hardwood floors', 'Yard access'])
  })

  it('splits legacy comma-separated features strings', () => {
    const brief = parseListingBrief({ features: 'Hardwood floors, South-facing, Yard access' })
    expect(brief.features).toEqual(['Hardwood floors', 'South-facing', 'Yard access'])
  })

  it('defaults features to empty array', () => {
    expect(parseListingBrief({}).features).toEqual([])
    expect(parseListingBrief(null).features).toEqual([])
  })
})

describe('listingBriefToPromptLines', () => {
  it('joins standout features for the AI prompt', () => {
    const lines = listingBriefToPromptLines(
      parseListingBrief({ pets: 'Cats OK', features: ['Hardwood floors', 'Yard access'] })
    )
    expect(lines).toContain('Pets: Cats OK')
    expect(lines).toContain('Standout features: Hardwood floors, Yard access')
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
