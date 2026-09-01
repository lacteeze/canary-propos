export type OnboardingPath = 'vacant' | 'occupied'

export type OnboardingStep = 'path' | 'details' | 'photos' | 'listing' | 'lease'

export type MissingMustHave =
  | 'path'
  | 'details'
  | 'owner'
  | 'photos'
  | 'listing'
  | 'lease'
  | 'tenant'

export type OnboardingSnapshot = {
  path: OnboardingPath | null
  detailsCompletedAt: string | null
  ownerId: string | null
  listingPhotoCount: number
  hasListing: boolean
  hasLease: boolean
  hasTenant: boolean
  archivedAt?: string | null
  completedAt?: string | null
}

export const MISSING_MUST_HAVE_LABEL: Record<MissingMustHave, string> = {
  path: 'Path',
  details: 'Details',
  owner: 'Owner',
  photos: 'Photos',
  listing: 'Listing',
  lease: 'Lease',
  tenant: 'Tenant',
}

export function stepsForPath(path: OnboardingPath | null): OnboardingStep[] {
  if (path === 'occupied') return ['path', 'details', 'photos', 'lease']
  if (path === 'vacant') return ['path', 'details', 'photos', 'listing']
  return ['path']
}

export function missingMustHaves(snapshot: OnboardingSnapshot): MissingMustHave[] {
  const missing: MissingMustHave[] = []
  if (snapshot.path !== 'vacant' && snapshot.path !== 'occupied') missing.push('path')
  if (!snapshot.detailsCompletedAt) missing.push('details')
  if (!snapshot.ownerId) missing.push('owner')
  if (snapshot.listingPhotoCount < 1) missing.push('photos')
  if (snapshot.path === 'vacant' && !snapshot.hasListing) missing.push('listing')
  if (snapshot.path === 'occupied') {
    if (!snapshot.hasLease) missing.push('lease')
    if (!snapshot.hasTenant) missing.push('tenant')
  }
  return missing
}

export function isOnboardingComplete(snapshot: OnboardingSnapshot): boolean {
  return missingMustHaves(snapshot).length === 0
}

/** Incomplete, not archived, not already completed. */
export function inNeedsSetupQueue(snapshot: OnboardingSnapshot): boolean {
  if (snapshot.archivedAt) return false
  if (snapshot.completedAt) return false
  return !isOnboardingComplete(snapshot)
}

export function canSwitchPathWithoutConfirm(snapshot: Pick<OnboardingSnapshot, 'hasListing' | 'hasLease'>): boolean {
  return !snapshot.hasListing && !snapshot.hasLease
}

/** After a listing draft writes, send staff to the first remaining must-have instead of the dashboard. */
export function stepAfterListingDraftSave(missing: MissingMustHave[]): OnboardingStep | 'done' {
  if (missing.length === 0) return 'done'
  if (missing.includes('owner') || missing.includes('details') || missing.includes('path')) return 'details'
  if (missing.includes('photos')) return 'photos'
  return 'listing'
}

export function defaultOwnerPortfolioName(ownerName: string): string {
  const name = ownerName.trim()
  return name || 'New portfolio'
}

export type SelectOption = {
  value: string
  label: string
  searchText?: string
}

export function isOwnerPerson(person: { roles?: string[]; role?: string }): boolean {
  if (person.roles?.includes('owner')) return true
  return person.role === 'Client' || person.role === 'Owner'
}

/** Keep a just-created row visible in a combobox before `router.refresh()` lands. */
export function mergeSelectOptions(options: SelectOption[], extra: SelectOption[]): SelectOption[] {
  const seen = new Set(options.map((o) => o.value))
  const merged = [...options]
  for (const item of extra) {
    if (!item.value || seen.has(item.value)) continue
    merged.push(item)
    seen.add(item.value)
  }
  return merged
}
