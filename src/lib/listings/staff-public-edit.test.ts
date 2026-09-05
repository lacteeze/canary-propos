import { describe, expect, it } from 'vitest'
import { canSeePublicListingEdit, staffListingEditHref } from './staff-public-edit'

describe('canSeePublicListingEdit', () => {
  it('hides the control from the public and non-staff roles', () => {
    expect(canSeePublicListingEdit(null)).toBe(false)
    expect(canSeePublicListingEdit('tenant', 'org-1', 'org-1')).toBe(false)
    expect(canSeePublicListingEdit('owner', 'org-1', 'org-1')).toBe(false)
    expect(canSeePublicListingEdit('vendor', 'org-1', 'org-1')).toBe(false)
    expect(canSeePublicListingEdit('employee', 'org-1', 'org-1')).toBe(false)
  })

  it('shows the control for managers and admins in the same org', () => {
    expect(canSeePublicListingEdit('manager', 'org-1', 'org-1')).toBe(true)
    expect(canSeePublicListingEdit('admin', 'org-1', 'org-1')).toBe(true)
    expect(canSeePublicListingEdit(['manager', 'owner'], 'org-1', 'org-1')).toBe(true)
  })

  it('hides the control when the session belongs to another org', () => {
    expect(canSeePublicListingEdit('manager', 'org-a', 'org-b')).toBe(false)
  })
})

describe('staffListingEditHref', () => {
  it('opens the staff listing editor', () => {
    expect(staffListingEditHref('listing-1')).toBe('/app/listings/listing-1')
  })
})
