import { describe, expect, it } from 'vitest'
import {
  canSwitchPathWithoutConfirm,
  defaultOwnerPortfolioName,
  inNeedsSetupQueue,
  isOnboardingComplete,
  isOwnerPerson,
  mergeSelectOptions,
  missingMustHaves,
  stepAfterListingDraftSave,
  stepsForPath,
} from './property-onboarding'

const vacantReady = {
  path: 'vacant' as const,
  detailsCompletedAt: '2026-09-01T12:00:00.000Z',
  ownerId: 'owner-1',
  listingPhotoCount: 1,
  hasListing: true,
  hasLease: false,
  hasTenant: false,
}

describe('stepsForPath', () => {
  it('stops at path until chosen', () => {
    expect(stepsForPath(null)).toEqual(['path'])
  })

  it('uses listing for vacant and lease for occupied', () => {
    expect(stepsForPath('vacant')).toEqual(['path', 'details', 'photos', 'listing'])
    expect(stepsForPath('occupied')).toEqual(['path', 'details', 'photos', 'lease'])
  })
})

describe('missingMustHaves', () => {
  it('treats factory-default beds as incomplete until details are saved', () => {
    expect(
      missingMustHaves({
        path: 'vacant',
        detailsCompletedAt: null,
        ownerId: 'owner-1',
        listingPhotoCount: 2,
        hasListing: true,
        hasLease: false,
        hasTenant: false,
      }),
    ).toEqual(['details'])
  })

  it('requires owner even after details are saved', () => {
    expect(
      missingMustHaves({
        ...vacantReady,
        ownerId: null,
      }),
    ).toEqual(['owner'])
  })

  it('requires a listing photo', () => {
    expect(missingMustHaves({ ...vacantReady, listingPhotoCount: 0 })).toEqual(['photos'])
  })

  it('requires a listing on the vacant path only', () => {
    expect(missingMustHaves({ ...vacantReady, hasListing: false })).toEqual(['listing'])
    expect(
      missingMustHaves({
        path: 'occupied',
        detailsCompletedAt: vacantReady.detailsCompletedAt,
        ownerId: 'owner-1',
        listingPhotoCount: 1,
        hasListing: false,
        hasLease: true,
        hasTenant: true,
      }),
    ).toEqual([])
  })

  it('requires lease and tenant on the occupied path', () => {
    expect(
      missingMustHaves({
        path: 'occupied',
        detailsCompletedAt: vacantReady.detailsCompletedAt,
        ownerId: 'owner-1',
        listingPhotoCount: 1,
        hasListing: false,
        hasLease: false,
        hasTenant: false,
      }),
    ).toEqual(['lease', 'tenant'])
  })
})

describe('isOnboardingComplete / inNeedsSetupQueue', () => {
  it('completes vacant when must-haves are met', () => {
    expect(isOnboardingComplete(vacantReady)).toBe(true)
    expect(inNeedsSetupQueue(vacantReady)).toBe(false)
  })

  it('drops archived and already-completed rows from the queue', () => {
    expect(inNeedsSetupQueue({ ...vacantReady, hasListing: false, archivedAt: '2026-09-01' })).toBe(false)
    expect(inNeedsSetupQueue({ ...vacantReady, hasListing: false, completedAt: '2026-09-01' })).toBe(false)
    expect(inNeedsSetupQueue({ ...vacantReady, hasListing: false })).toBe(true)
  })
})

describe('stepAfterListingDraftSave', () => {
  it('stays in setup on details when the owner is still missing', () => {
    expect(stepAfterListingDraftSave(['owner'])).toBe('details')
    expect(stepAfterListingDraftSave(['owner', 'photos'])).toBe('details')
  })

  it('leaves setup only when nothing is left', () => {
    expect(stepAfterListingDraftSave([])).toBe('done')
  })
})

describe('canSwitchPathWithoutConfirm', () => {
  it('allows a free switch until a listing or lease exists', () => {
    expect(canSwitchPathWithoutConfirm({ hasListing: false, hasLease: false })).toBe(true)
    expect(canSwitchPathWithoutConfirm({ hasListing: true, hasLease: false })).toBe(false)
    expect(canSwitchPathWithoutConfirm({ hasListing: false, hasLease: true })).toBe(false)
  })
})

describe('defaultOwnerPortfolioName', () => {
  it('uses the owner name as the portfolio name', () => {
    expect(defaultOwnerPortfolioName('Beth Whalen')).toBe('Beth Whalen')
  })

  it('falls back when the name is blank', () => {
    expect(defaultOwnerPortfolioName('   ')).toBe('New portfolio')
  })
})

describe('mergeSelectOptions', () => {
  it('keeps a just-created owner in the list before the server refresh', () => {
    const merged = mergeSelectOptions(
      [
        { value: '', label: 'No owner yet' },
        { value: 'old', label: 'Existing Owner' },
      ],
      [{ value: 'new', label: 'Beth Whalen', searchText: 'Beth Whalen nfbethwhelan@gmail.com' }],
    )
    expect(merged.map((o) => o.value)).toEqual(['', 'old', 'new'])
    expect(merged[2]?.label).toBe('Beth Whalen')
  })

  it('does not duplicate an id that the server list already has', () => {
    const merged = mergeSelectOptions(
      [{ value: 'new', label: 'Beth Whalen' }],
      [{ value: 'new', label: 'Beth Whalen' }],
    )
    expect(merged).toHaveLength(1)
  })
})

describe('isOwnerPerson', () => {
  it('treats the owner role as a client even when the display label is missing', () => {
    expect(isOwnerPerson({ roles: ['owner'] })).toBe(true)
    expect(isOwnerPerson({ role: 'Client' })).toBe(true)
    expect(isOwnerPerson({ roles: ['tenant'], role: 'Tenant' })).toBe(false)
  })
})
