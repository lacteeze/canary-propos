import { describe, expect, it } from 'vitest'
import type { CanaryInquiry } from './types'
import {
  countInquiriesForListing,
  groupInquiriesByProperty,
  inquiryGroupMeta,
  inquiryMatchesListingGroup,
} from './pipeline-groups'

function inquiry(
  partial: Partial<CanaryInquiry> & Pick<CanaryInquiry, 'id' | 'name' | 'property'>,
): CanaryInquiry {
  return {
    listingId: null,
    propertyId: null,
    type: 'inquiry',
    email: 't@example.com',
    phone: '',
    status: 'new',
    submittedAt: '2026-08-01T00:00:00.000Z',
    moveIn: '',
    viewingAt: null,
    note: '',
    isGeneralInterest: false,
    orgSlug: 'canary',
    latestNote: null,
    ...partial,
  }
}

describe('inquiryGroupMeta', () => {
  it('keys linked properties by propertyId', () => {
    const meta = inquiryGroupMeta(
      inquiry({
        id: '1',
        name: 'Mike',
        property: "18 B Wood St, St. John's",
        propertyId: 'wood',
      }),
    )
    expect(meta).toEqual({ key: 'prop:wood', label: '18 B Wood St' })
  })

  it('keys general interest by label when no property is linked', () => {
    const meta = inquiryGroupMeta(
      inquiry({
        id: '2',
        name: 'Emma',
        property: 'General interest',
        isGeneralInterest: true,
      }),
    )
    expect(meta).toEqual({ key: 'interest:general interest', label: 'General interest' })
  })
})

describe('groupInquiriesByProperty', () => {
  it('groups two Wood St cards plus general interest, most first, without dropping cards', () => {
    const woodA = inquiry({
      id: '1',
      name: 'Mike LeBlanc',
      property: "18 B Wood St, St. John's",
      propertyId: 'wood',
    })
    const woodB = inquiry({
      id: '2',
      name: 'Renée Stamp',
      property: "18 B Wood St, St. John's",
      propertyId: 'wood',
    })
    const general = inquiry({
      id: '3',
      name: 'Emma Piercey',
      property: 'General interest',
      isGeneralInterest: true,
    })

    const groups = groupInquiriesByProperty([woodA, woodB, general])

    expect(groups.map((g) => [g.label, g.inquiries.length])).toEqual([
      ['18 B Wood St', 2],
      ['General interest', 1],
    ])
    expect(groups.flatMap((g) => g.inquiries.map((i) => i.id)).sort()).toEqual(['1', '2', '3'])
    expect(groups[0]!.inquiries.map((i) => i.name)).toEqual(['Mike LeBlanc', 'Renée Stamp'])
  })

  it('keeps existing column order inside a group', () => {
    const later = inquiry({
      id: 'b',
      name: 'Second',
      property: '9 Bond St',
      propertyId: 'bond',
    })
    const earlier = inquiry({
      id: 'a',
      name: 'First',
      property: '9 Bond St',
      propertyId: 'bond',
    })
    const groups = groupInquiriesByProperty([later, earlier])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.inquiries.map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('does not lose cards across mixed addresses and interest labels', () => {
    const items = [
      inquiry({ id: '1', name: 'A', property: '1 Duckworth', propertyId: 'd1' }),
      inquiry({ id: '2', name: 'B', property: 'General interest', isGeneralInterest: true }),
      inquiry({ id: '3', name: 'C', property: '1 Duckworth', propertyId: 'd1' }),
      inquiry({ id: '4', name: 'D', property: '22 Water St' }),
      inquiry({ id: '5', name: 'E', property: 'General interest', isGeneralInterest: true }),
    ]
    const groups = groupInquiriesByProperty(items)
    expect(groups.flatMap((g) => g.inquiries)).toHaveLength(items.length)
    expect(new Set(groups.flatMap((g) => g.inquiries.map((i) => i.id)))).toEqual(
      new Set(items.map((i) => i.id)),
    )
  })
})

describe('inquiryMatchesListingGroup', () => {
  const wood = { listingId: 'list-wood', propertyId: 'wood', address: "18 A Wood St, St. John's" }

  it('matches by propertyId and listingId, skips closed', () => {
    expect(
      inquiryMatchesListingGroup(
        inquiry({ id: '1', name: 'A', property: '18 A Wood St', propertyId: 'wood' }),
        wood,
      ),
    ).toBe(true)
    expect(
      inquiryMatchesListingGroup(
        inquiry({ id: '2', name: 'B', property: 'Other', listingId: 'list-wood' }),
        wood,
      ),
    ).toBe(true)
    expect(
      inquiryMatchesListingGroup(
        inquiry({ id: '3', name: 'C', property: '18 A Wood St', propertyId: 'wood', status: 'closed' }),
        wood,
      ),
    ).toBe(false)
    expect(
      inquiryMatchesListingGroup(
        inquiry({ id: '4', name: 'D', property: 'General interest', isGeneralInterest: true }),
        wood,
      ),
    ).toBe(false)
  })

  it('counts open pipeline cards for a listing', () => {
    const inquiries = [
      inquiry({ id: '1', name: 'A', property: '18 A Wood St', propertyId: 'wood' }),
      inquiry({ id: '2', name: 'B', property: '18 A Wood St', propertyId: 'wood', status: 'signed' }),
      inquiry({ id: '3', name: 'C', property: '18 A Wood St', propertyId: 'wood', status: 'closed' }),
      inquiry({ id: '4', name: 'D', property: '9 Bond St', propertyId: 'bond' }),
    ]
    expect(countInquiriesForListing(inquiries, wood)).toBe(2)
  })
})
