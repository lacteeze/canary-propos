import { describe, expect, it } from 'vitest'
import type { HospitableProperty } from '@/lib/hospitable/client'
import { upgradeHospitablePictureUrl } from '@/lib/hospitable/map-property-to-stay'
import {
  resolveStayCoverPath,
  resolveStaySlug,
  streetKeysForHospitableProperty,
  type StayCoverLookup,
} from './stay-cover-photos'

describe('upgradeHospitablePictureUrl', () => {
  it('upgrades Airbnb aki_policy=small to large', () => {
    const input =
      'https://a0.muscache.com/im/pictures/hosting/Hosting-1/original/abc.jpeg?aki_policy=small'
    expect(upgradeHospitablePictureUrl(input)).toBe(
      'https://a0.muscache.com/im/pictures/hosting/Hosting-1/original/abc.jpeg?aki_policy=large'
    )
  })

  it('strips Hospitable CDN thumb- prefix', () => {
    const input =
      'https://assets.hospitable.com/property_images/2244974/thumb-gZKkPOLJMbuiWF3ZgKO9hrz3SmiK31N21u1saWo9.jpg'
    expect(upgradeHospitablePictureUrl(input)).toBe(
      'https://assets.hospitable.com/property_images/2244974/gZKkPOLJMbuiWF3ZgKO9hrz3SmiK31N21u1saWo9.jpg'
    )
  })

  it('returns null for empty input', () => {
    expect(upgradeHospitablePictureUrl(null)).toBeNull()
    expect(upgradeHospitablePictureUrl('  ')).toBeNull()
  })
})

describe('resolveStayCoverPath', () => {
  const lookup: StayCoverLookup = {
    byHospitableId: new Map([
      ['hosp-bonaventure', 'org/properties/bonaventure/photos/cover.jpg'],
    ]),
    byStreetKey: new Map([
      ['73 casey st', 'org/properties/casey/photos/cover.jpg'],
      ['14 bonaventure ave', 'org/properties/bonaventure/photos/cover.jpg'],
    ]),
    slugByHospitableId: new Map([
      ['hosp-bonaventure', '14-bonaventure-ave'],
      ['d26f423d-af7a-43c4-859b-45640c85bed5', '21-front-rd'],
    ]),
    slugByStreetKey: new Map([
      ['73 casey st', '73-casey-street'],
      ['21 front rd', '21-front-rd'],
    ]),
  }

  it('prefers explicit hospitable_property_id match', () => {
    const property: HospitableProperty = {
      id: 'hosp-bonaventure',
      public_name: 'Cozy 2 bedroom home in downtown St Johns',
      address: { city: "St. John's", display: '14 Bonaventure Avenue' },
    }
    expect(resolveStayCoverPath(property, lookup)).toBe(
      'org/properties/bonaventure/photos/cover.jpg'
    )
  })

  it('falls back to street / booking-slug match when id is unset', () => {
    const property: HospitableProperty = {
      id: 'hosp-casey-unlinked',
      public_name: 'Harbourfront Hideaway Downtown',
      address: { city: "St. John's", display: '73 Casey Street' },
      bookings: { site_urls: ['https://canarypm.ca/73-casey-street'] },
    }
    expect(streetKeysForHospitableProperty(property)).toContain('73 casey st')
    expect(resolveStayCoverPath(property, lookup)).toBe(
      'org/properties/casey/photos/cover.jpg'
    )
  })

  it('returns null when nothing matches', () => {
    const property: HospitableProperty = {
      id: 'unknown',
      public_name: 'Somewhere Else',
      address: { city: 'Harbour Grace', display: '99 Nowhere Lane' },
    }
    expect(resolveStayCoverPath(property, lookup)).toBeNull()
  })
})

describe('resolveStaySlug', () => {
  const lookup: StayCoverLookup = {
    byHospitableId: new Map(),
    byStreetKey: new Map(),
    slugByHospitableId: new Map([
      ['d26f423d-af7a-43c4-859b-45640c85bed5', '21-front-rd'],
    ]),
    slugByStreetKey: new Map([['21 front rd', '21-front-rd']]),
  }

  it('resolves PropOS slug from Hospitable API UUID', () => {
    const property: HospitableProperty = {
      id: 'd26f423d-af7a-43c4-859b-45640c85bed5',
      public_name: 'Modern Home Steps from Brewery with Ocean View',
      address: { city: 'Dildo', display: '21 front road' },
    }
    expect(resolveStaySlug(property, lookup)).toBe('21-front-rd')
  })

  it('falls back to street key when UUID is not linked', () => {
    const property: HospitableProperty = {
      id: 'unlinked',
      public_name: 'Ocean View',
      address: { city: 'Dildo', display: '21 Front Road' },
    }
    expect(resolveStaySlug(property, lookup)).toBe('21-front-rd')
  })
})
