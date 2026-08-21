import { describe, expect, it } from 'vitest'
import {
  listingMatchesAddressQuery,
  publicSlugFromSearchText,
  publicSlugLookupCandidates,
  streetSuffixSlugAliases,
} from './slug-aliases'

describe('streetSuffixSlugAliases', () => {
  it('maps rd ↔ road', () => {
    expect(streetSuffixSlugAliases('156-three-island-pond-rd')).toEqual([
      '156-three-island-pond-road',
    ])
    expect(streetSuffixSlugAliases('156-three-island-pond-road')).toEqual([
      '156-three-island-pond-rd',
    ])
  })

  it('maps st ↔ street and keeps collision suffixes', () => {
    expect(streetSuffixSlugAliases('75-casey-st')).toEqual(['75-casey-street'])
    expect(streetSuffixSlugAliases('75-casey-st-2')).toEqual(['75-casey-street-2'])
  })

  it('does not rewrite tokens that are not a trailing street type', () => {
    expect(streetSuffixSlugAliases('st-johns-harbour')).toEqual([])
  })
})

describe('publicSlugLookupCandidates', () => {
  it('puts the exact slug first', () => {
    expect(publicSlugLookupCandidates('156-three-island-pond-rd')).toEqual([
      '156-three-island-pond-rd',
      '156-three-island-pond-road',
    ])
  })
})

describe('publicSlugFromSearchText', () => {
  it('extracts the path from a canarypm.ca URL', () => {
    expect(
      publicSlugFromSearchText('https://canarypm.ca/156-three-island-pond-road'),
    ).toBe('156-three-island-pond-road')
  })
})

describe('listingMatchesAddressQuery', () => {
  const listing = {
    href: '/156-three-island-pond-rd',
    shortAddress: '156 Three Island Pond Rd',
    city: "St. John's",
    province: 'NL',
  }

  it('matches the stored rd address', () => {
    expect(listingMatchesAddressQuery('156 three island pond rd', listing)).toBe(true)
  })

  it('matches the road spelling and full public URL', () => {
    expect(listingMatchesAddressQuery('156 three island pond road', listing)).toBe(true)
    expect(
      listingMatchesAddressQuery('https://canarypm.ca/156-three-island-pond-road', listing),
    ).toBe(true)
  })
})
