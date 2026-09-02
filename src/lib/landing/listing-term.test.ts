import { describe, expect, it } from 'vitest'
import {
  deriveTermTypeFromHighlights,
  LONG_TERM_LEASE,
  MID_TERM_LEASE,
  withListingTermHighlight,
} from './listing-term'

describe('withListingTermHighlight', () => {
  it('puts Mid-term lease first and keeps other highlights', () => {
    expect(withListingTermHighlight(['Parking included', 'Pet friendly'], 'mid')).toEqual([
      MID_TERM_LEASE,
      'Parking included',
      'Pet friendly',
    ])
  })

  it('replaces an existing term highlight instead of duplicating', () => {
    expect(withListingTermHighlight([LONG_TERM_LEASE, 'In-unit laundry'], 'mid')).toEqual([
      MID_TERM_LEASE,
      'In-unit laundry',
    ])
    expect(withListingTermHighlight(['Mid-term', 'Quiet street'], 'long')).toEqual([
      LONG_TERM_LEASE,
      'Quiet street',
    ])
  })
})

describe('deriveTermTypeFromHighlights', () => {
  it('treats a mid-term highlight as mid and everything else as long', () => {
    expect(deriveTermTypeFromHighlights([MID_TERM_LEASE])).toBe('mid')
    expect(deriveTermTypeFromHighlights([LONG_TERM_LEASE])).toBe('long')
    expect(deriveTermTypeFromHighlights(null)).toBe('long')
  })
})
