import { describe, expect, it } from 'vitest'
import {
  compareCurrentListingsByDate,
  currentListingGroupId,
  groupCurrentListings,
} from './current-listings-groups'

describe('currentListingGroupId', () => {
  it('puts renewal_sent and declined in Renewals regardless of occupancy', () => {
    expect(currentListingGroupId('renewal_sent')).toBe('renewals')
    expect(currentListingGroupId('declined')).toBe('renewals')
  })

  it('does not treat Leased occupancy as a renewal', () => {
    expect(currentListingGroupId('published')).toBe('listed')
    expect(currentListingGroupId('draft')).toBe('drafts')
  })

  it('puts unpublished drafts in Drafts', () => {
    expect(currentListingGroupId('draft')).toBe('drafts')
  })

  it('puts published / live non-renewals in Listed', () => {
    expect(currentListingGroupId('published')).toBe('listed')
  })

  it('uses Renewals > Drafts > Listed when status could be read two ways', () => {
    expect(currentListingGroupId('renewal_sent')).toBe('renewals')
    expect(currentListingGroupId('declined')).toBe('renewals')
    expect(currentListingGroupId('draft')).toBe('drafts')
  })
})

describe('groupCurrentListings', () => {
  it('lands Job St, Casey St, Cavell, and a yellow-dot draft in the right groups', () => {
    const job = { id: 'job', address: '48 Job St', title: '', start: '2026-08-01', status: 'renewal_sent' }
    const casey = { id: 'casey', address: '75 Casey St', title: '', start: '2026-09-01', status: 'published' }
    const cavell = { id: 'cavell', address: '14 Cavell Ave', title: '', start: '2026-11-01', status: 'published' }
    const draft = { id: 'draft', address: '12 Water St', title: 'Draft unit', start: '2026-10-01', status: 'draft' }
    const cambridge = { id: 'cambridge', address: '3 A Cambridge Ave', title: '', start: '2026-10-01', status: 'draft' }

    const groups = groupCurrentListings([casey, draft, job, cavell, cambridge])

    expect(groups.map((g) => [g.id, g.items.map((i) => i.id)])).toEqual([
      ['renewals', ['job']],
      ['drafts', ['draft', 'cambridge']],
      ['listed', ['casey', 'cavell']],
    ])
  })

  it('puts 14 Cavell Ave (published, newly listed lease) in Listed', () => {
    const groups = groupCurrentListings([
      { id: 'cavell', address: '14 Cavell Ave', start: '2026-11-01', status: 'published' },
    ])
    expect(groups).toEqual([
      {
        id: 'listed',
        label: 'Listed',
        items: [{ id: 'cavell', address: '14 Cavell Ave', start: '2026-11-01', status: 'published' }],
      },
    ])
  })

  it('hides empty groups and never drops or duplicates a row', () => {
    const rows = [
      { id: 'a', address: 'A St', start: '2026-08-01', status: 'published' },
      { id: 'b', address: 'B St', start: '2026-07-01', status: 'published' },
    ]
    const groups = groupCurrentListings(rows)
    expect(groups.map((g) => g.id)).toEqual(['listed'])
    expect(groups.flatMap((g) => g.items.map((i) => i.id)).sort()).toEqual(['a', 'b'])
  })

  it('sorts by soonest date within each group', () => {
    const later = { id: 'later', address: 'Later St', start: '2026-12-01', status: 'renewal_sent' }
    const sooner = { id: 'sooner', address: 'Sooner St', start: '2026-08-01', status: 'declined' }
    const groups = groupCurrentListings([later, sooner])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.items.map((i) => i.id)).toEqual(['sooner', 'later'])
  })
})

describe('compareCurrentListingsByDate', () => {
  it('puts missing dates after dated rows', () => {
    const dated = { address: 'Z St', start: '2026-08-01' }
    const blank = { address: 'A St', start: '' }
    expect(compareCurrentListingsByDate(dated, blank)).toBeLessThan(0)
    expect(compareCurrentListingsByDate(blank, dated)).toBeGreaterThan(0)
  })
})
