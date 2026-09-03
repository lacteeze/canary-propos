import { describe, expect, it } from 'vitest'
import { brandFromOrg, defaultProvinceFromOrg } from '@/lib/brand'

describe('brandFromOrg', () => {
  it('uses Canary values only when the org slug is canary', () => {
    expect(brandFromOrg({ slug: 'canary', name: 'Other' }).name).toBe(
      'Canary Property Management',
    )
    expect(brandFromOrg({ slug: 'harbourview', name: 'Harbourview Holdings' }).name).toBe(
      'Harbourview Holdings',
    )
  })
})

describe('defaultProvinceFromOrg', () => {
  it('uses the org province instead of NL', () => {
    expect(defaultProvinceFromOrg('ON')).toBe('ON')
    expect(defaultProvinceFromOrg(null)).toBe('')
  })
})
