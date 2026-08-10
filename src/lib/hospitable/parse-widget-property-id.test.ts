import { describe, expect, it } from 'vitest'
import {
  normalizeHospitableWidgetPropertyIdInput,
  parseHospitableWidgetPropertyId,
  parseHospitableWidgetSiteUuid,
} from './parse-widget-property-id'

describe('parseHospitableWidgetPropertyId', () => {
  it('accepts bare numeric IDs', () => {
    expect(parseHospitableWidgetPropertyId('870564')).toBe('870564')
    expect(parseHospitableWidgetPropertyId('  796518  ')).toBe('796518')
  })

  it('extracts trailing property ID from widget URLs', () => {
    expect(
      parseHospitableWidgetPropertyId(
        'https://booking.hospitable.com/widget/9f1c2015-de57-4be3-a80c-1927d81e8f41/870564',
      ),
    ).toBe('870564')

    expect(
      parseHospitableWidgetPropertyId(
        'https://booking.hospitable.com/widget/9f1c2015-de57-4be3-a80c-1927d81e8f41/870564?theme=city#x',
      ),
    ).toBe('870564')

    expect(
      parseHospitableWidgetPropertyId(
        'http://booking.hospitable.com/widget/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/123',
      ),
    ).toBe('123')
  })

  it('extracts data-property-id from embed snippets', () => {
    expect(
      parseHospitableWidgetPropertyId(
        '<div data-site-uuid="9f1c2015-de57-4be3-a80c-1927d81e8f41" data-property-id="870564"></div>',
      ),
    ).toBe('870564')

    expect(parseHospitableWidgetPropertyId("data-property-id='796518'")).toBe('796518')
    expect(parseHospitableWidgetPropertyId('data-property-id=42')).toBe('42')
  })

  it('returns null for blank or unusable input', () => {
    expect(parseHospitableWidgetPropertyId('')).toBeNull()
    expect(parseHospitableWidgetPropertyId('   ')).toBeNull()
    expect(parseHospitableWidgetPropertyId('not-a-widget-id')).toBeNull()
    expect(
      parseHospitableWidgetPropertyId('https://example.com/widget/foo/bar'),
    ).toBeNull()
  })
})

describe('parseHospitableWidgetSiteUuid', () => {
  it('extracts site UUID from widget URLs', () => {
    expect(
      parseHospitableWidgetSiteUuid(
        'https://booking.hospitable.com/widget/9f1c2015-de57-4be3-a80c-1927d81e8f41/870564',
      ),
    ).toBe('9f1c2015-de57-4be3-a80c-1927d81e8f41')
  })

  it('returns null when no widget path is present', () => {
    expect(parseHospitableWidgetSiteUuid('870564')).toBeNull()
    expect(parseHospitableWidgetSiteUuid('data-property-id="870564"')).toBeNull()
  })
})

describe('normalizeHospitableWidgetPropertyIdInput', () => {
  it('normalizes URLs and clears blanks', () => {
    expect(
      normalizeHospitableWidgetPropertyIdInput(
        'https://booking.hospitable.com/widget/9f1c2015-de57-4be3-a80c-1927d81e8f41/870564',
      ),
    ).toBe('870564')
    expect(normalizeHospitableWidgetPropertyIdInput('  ')).toBe('')
    expect(normalizeHospitableWidgetPropertyIdInput('garbage')).toBe('garbage')
  })
})
