/** Staff home Current Listings: Renewals → Drafts → Listed. */

export type CurrentListingGroupId = 'renewals' | 'drafts' | 'listed'

export const CURRENT_LISTING_GROUPS: { id: CurrentListingGroupId; label: string }[] = [
  { id: 'renewals', label: 'Renewals' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'listed', label: 'Listed' },
]

export type CurrentListingSortable = {
  start: string
  address?: string
  title?: string
}

function parseSortDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function listingSortLabel(row: CurrentListingSortable): string {
  const street = (row.address || '').split(',')[0].trim()
  return street || row.title || 'Listing'
}

/** Soonest Date Available first; missing dates last; address as tiebreak. */
export function compareCurrentListingsByDate(a: CurrentListingSortable, b: CurrentListingSortable): number {
  const aDate = parseSortDate(a.start)
  const bDate = parseSortDate(b.start)
  if (aDate && bDate) {
    const byDate = aDate.getTime() - bDate.getTime()
    if (byDate !== 0) return byDate
  } else if (aDate) return -1
  else if (bDate) return 1
  return listingSortLabel(a).localeCompare(listingSortLabel(b), undefined, { sensitivity: 'base' })
}

/**
 * Priority: Renewals > Drafts > Listed.
 * Renewals = listing_status renewal_sent or declined only.
 * Occupancy (Leased/Vacant/STR) is not a grouping signal — a new lease can show Leased.
 */
export function currentListingGroupId(listingStatus: string): CurrentListingGroupId {
  if (listingStatus === 'renewal_sent' || listingStatus === 'declined') return 'renewals'
  if (listingStatus === 'draft') return 'drafts'
  return 'listed'
}

export type CurrentListingGroup<T> = {
  id: CurrentListingGroupId
  label: string
  items: T[]
}

export function groupCurrentListings<T extends CurrentListingSortable & { status: string; id?: string }>(
  listings: T[],
  pinnedIds?: ReadonlySet<string>,
): CurrentListingGroup<T>[] {
  const buckets: Record<CurrentListingGroupId, T[]> = {
    renewals: [],
    drafts: [],
    listed: [],
  }
  for (const listing of listings) {
    buckets[currentListingGroupId(listing.status)].push(listing)
  }
  return CURRENT_LISTING_GROUPS
    .map(({ id, label }) => ({
      id,
      label,
      items: [...buckets[id]].sort((a, b) => {
        if (id === 'drafts' && pinnedIds && pinnedIds.size) {
          const aPin = a.id && pinnedIds.has(a.id) ? 1 : 0
          const bPin = b.id && pinnedIds.has(b.id) ? 1 : 0
          if (aPin !== bPin) return bPin - aPin
        }
        return compareCurrentListingsByDate(a, b)
      }),
    }))
    .filter((group) => group.items.length > 0)
}
