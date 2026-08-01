import { describe, it, expect, vi } from 'vitest'
import {
  slugifyAddress,
  allocateUniqueListingSlug,
  allocateUniquePropertySlug,
  allocateListingSlugPreferProperty,
} from './slugify'
import { isReservedListingSlug } from './reserved-slugs'

describe('slugifyAddress', () => {
  it('uses first comma segment only', () => {
    expect(slugifyAddress("151 A Signal Hill Road, St. John's, NL")).toBe(
      '151-a-signal-hill-road',
    )
  })

  it('falls back to listing for empty/invalid input', () => {
    expect(slugifyAddress('  ##  ')).toBe('listing')
  })

  it('falls back to property when requested', () => {
    expect(slugifyAddress('  ##  ', 'property')).toBe('property')
  })
})

describe('isReservedListingSlug', () => {
  it('flags reserved path segments', () => {
    expect(isReservedListingSlug('login')).toBe(true)
    expect(isReservedListingSlug('property')).toBe(true)
  })

  it('allows address-like slugs', () => {
    expect(isReservedListingSlug('151-a-signal-hill-road')).toBe(false)
  })
})

describe('allocateUniqueListingSlug', () => {
  function mockSupabase(rows: { id: string; slug: string | null }[]) {
    return {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            not: vi.fn(async () => ({ data: rows, error: null })),
          })),
        })),
      })),
    }
  }

  it('returns base slug when free and not reserved', async () => {
    const supabase = mockSupabase([])
    const slug = await allocateUniqueListingSlug({
      supabase: supabase as never,
      orgId: 'org-1',
      streetAddress: '151 A Signal Hill Road, St. Johns',
    })
    expect(slug).toBe('151-a-signal-hill-road')
  })

  it('appends -2 when base is taken', async () => {
    const supabase = mockSupabase([
      { id: 'other', slug: '151-a-signal-hill-road' },
    ])
    const slug = await allocateUniqueListingSlug({
      supabase: supabase as never,
      orgId: 'org-1',
      streetAddress: '151 A Signal Hill Road',
    })
    expect(slug).toBe('151-a-signal-hill-road-2')
  })

  it('skips reserved base and uses -2', async () => {
    const supabase = mockSupabase([])
    const slug = await allocateUniqueListingSlug({
      supabase: supabase as never,
      orgId: 'org-1',
      streetAddress: 'login',
    })
    expect(slug).toBe('login-2')
    expect(isReservedListingSlug(slug)).toBe(false)
  })

  it('ignores excludeListingId when checking collisions', async () => {
    const supabase = mockSupabase([
      { id: 'self', slug: '151-a-signal-hill-road' },
    ])
    const slug = await allocateUniqueListingSlug({
      supabase: supabase as never,
      orgId: 'org-1',
      streetAddress: '151 A Signal Hill Road',
      excludeListingId: 'self',
    })
    expect(slug).toBe('151-a-signal-hill-road')
  })
})

describe('allocateListingSlugPreferProperty', () => {
  function mockListingSupabase(rows: { id: string; slug: string | null }[]) {
    return {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            not: vi.fn(async () => ({ data: rows, error: null })),
          })),
        })),
      })),
    }
  }

  it('uses property slug when free', async () => {
    const supabase = mockListingSupabase([])
    const slug = await allocateListingSlugPreferProperty({
      supabase: supabase as never,
      orgId: 'org-1',
      streetAddress: 'Other Road',
      propertySlug: '151-a-signal-hill-road',
    })
    expect(slug).toBe('151-a-signal-hill-road')
  })

  it('falls back when property slug taken by another listing', async () => {
    const supabase = mockListingSupabase([
      { id: 'other', slug: '151-a-signal-hill-road' },
    ])
    const slug = await allocateListingSlugPreferProperty({
      supabase: supabase as never,
      orgId: 'org-1',
      streetAddress: '151 A Signal Hill Road',
      propertySlug: '151-a-signal-hill-road',
    })
    expect(slug).toBe('151-a-signal-hill-road-2')
  })
})

describe('allocateUniquePropertySlug', () => {
  it('returns base when free among properties and foreign listings', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'properties') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              not: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            not: vi.fn(async () => ({
              data: [{ id: 'l1', slug: 'other-street', units: { property_id: 'p-other' } }],
              error: null,
            })),
          })),
        })),
      }
    })
    const slug = await allocateUniquePropertySlug({
      supabase: { from } as never,
      orgId: 'org-1',
      streetAddress: '151 A Signal Hill Road',
      excludePropertyId: 'p1',
    })
    expect(slug).toBe('151-a-signal-hill-road')
  })

  it('allows same property listing slug', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'properties') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              not: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            not: vi.fn(async () => ({
              data: [
                {
                  id: 'l1',
                  slug: '151-a-signal-hill-road',
                  units: { property_id: 'p1' },
                },
              ],
              error: null,
            })),
          })),
        })),
      }
    })
    const slug = await allocateUniquePropertySlug({
      supabase: { from } as never,
      orgId: 'org-1',
      streetAddress: '151 A Signal Hill Road',
      excludePropertyId: 'p1',
    })
    expect(slug).toBe('151-a-signal-hill-road')
  })
})
