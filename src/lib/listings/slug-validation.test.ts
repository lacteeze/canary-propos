import { describe, it, expect, vi } from 'vitest'
import {
  normalizePublicSlug,
  validatePublicSlug,
  isPublicSlugTaken,
} from './slug-validation'

describe('normalizePublicSlug', () => {
  it('lowercases and kebab-cases', () => {
    expect(normalizePublicSlug('  151 A Signal Hill Rd  ')).toBe('151-a-signal-hill-rd')
  })

  it('collapses repeated separators', () => {
    expect(normalizePublicSlug('Foo___Bar--Baz')).toBe('foo-bar-baz')
  })
})

describe('validatePublicSlug', () => {
  it('accepts address-like slugs', () => {
    expect(validatePublicSlug('151-a-signal-hill-rd')).toEqual({
      ok: true,
      slug: '151-a-signal-hill-rd',
    })
  })

  it('rejects reserved paths', () => {
    const res = validatePublicSlug('login')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/reserved/i)
  })

  it('rejects empty input', () => {
    const res = validatePublicSlug('   ')
    expect(res.ok).toBe(false)
  })

  it('rejects UUID-shaped slugs', () => {
    const res = validatePublicSlug('550e8400-e29b-41d4-a716-446655440000')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/UUID/i)
  })

  it('normalizes before validating', () => {
    expect(validatePublicSlug('151 A Signal Hill Rd')).toEqual({
      ok: true,
      slug: '151-a-signal-hill-rd',
    })
  })
})

describe('isPublicSlugTaken', () => {
  it('detects collision on another property', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'properties') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [{ id: 'other-prop', slug: '151-a-signal-hill-rd' }],
                error: null,
              })),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      }
    })
    const res = await isPublicSlugTaken({
      supabase: { from } as never,
      orgId: 'org-1',
      slug: '151-a-signal-hill-rd',
      excludePropertyId: 'self',
    })
    expect(res).toEqual({ taken: true, by: 'property' })
  })

  it('ignores excluded listing ids (sync targets)', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'properties') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [{ id: 'listing-self', slug: '151-a-signal-hill-rd' }],
              error: null,
            })),
          })),
        })),
      }
    })
    const res = await isPublicSlugTaken({
      supabase: { from } as never,
      orgId: 'org-1',
      slug: '151-a-signal-hill-rd',
      excludePropertyId: 'prop-1',
      excludeListingIds: ['listing-self'],
    })
    expect(res).toEqual({ taken: false, by: null })
  })
})
