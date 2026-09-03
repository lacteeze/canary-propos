import { describe, expect, it } from 'vitest'
import { resolvePetLabel, resolveUtilitiesLabel } from '@/lib/listings/browse-utils'
import {
  addressListingTitle,
  listingDescriptionOnly,
  mergeListingBriefPatch,
  resolveListingTitle,
  staffPetsLabel,
  staffUtilitiesLabel,
} from '@/lib/listings/listing-write'

describe('resolveListingTitle', () => {
  it('keeps a custom title when saving from CanaryApp', () => {
    expect(
      resolveListingTitle({
        inputTitle: 'Harbourview 2-bed',
        existingTitle: '12 Water St, St. John\'s',
        addressTitle: '12 Water St, St. John\'s',
        isCreate: false,
      }),
    ).toBe('Harbourview 2-bed')
  })

  it('does not overwrite an existing custom title when the composer omits one', () => {
    expect(
      resolveListingTitle({
        inputTitle: null,
        existingTitle: 'Harbourview 2-bed',
        addressTitle: '12 Water St, St. John\'s',
        isCreate: false,
      }),
    ).toBe('Harbourview 2-bed')
  })

  it('defaults to the address only when creating and no title was entered', () => {
    expect(
      resolveListingTitle({
        inputTitle: '',
        existingTitle: null,
        addressTitle: addressListingTitle('12 Water St', 'St. John\'s'),
        isCreate: true,
      }),
    ).toBe('12 Water St, St. John\'s')
  })
})

describe('listing description', () => {
  it('does not append pets or utilities copy', () => {
    expect(listingDescriptionOnly('Bright unit downtown.')).toBe('Bright unit downtown.')
    expect(listingDescriptionOnly('  ')).toBeNull()
  })
})

describe('listing_brief labels', () => {
  it('staff draft and public page use the same pets/utilities resolver for one listing', () => {
    const briefPets = 'By approval'
    const briefUtilities = 'Heat, Light & Internet Included'
    const amenities = ['Dog friendly']
    const description = 'Pets not mentioned. Pay your own hydro.'

    expect(staffPetsLabel(briefPets, amenities, description)).toBe(
      resolvePetLabel({ briefPets, amenities, description }) ?? 'No pets',
    )
    const publicUtilities = resolveUtilitiesLabel({
      briefUtilities,
      description,
      amenities,
    })
    const staffUtilities = staffUtilitiesLabel(briefUtilities, description, amenities)
    if (publicUtilities === 'Utilities included') expect(staffUtilities).toBe('Included')
    else if (publicUtilities === 'POU') expect(staffUtilities).toBe('Not included')
    else expect(staffUtilities).toBe(briefUtilities)
  })

  it('writes pets and utilities onto listing_brief instead of the description', () => {
    const next = mergeListingBriefPatch(
      { parking: '1 driveway spot' },
      { pets: 'By approval', utilities: 'Included' },
    )
    expect(next.pets).toBe('By approval')
    expect(next.utilities).toBe('Utilities included')
    expect(next.parking).toBe('1 driveway spot')
  })
})
