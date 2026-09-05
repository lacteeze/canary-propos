import type { BrowseListing } from '@/lib/listings/browse-types'
import { listingsForMatch } from './match'
import {
  formatCad,
  formatGroupAsOf,
  type ListingGroupDef,
  type ListingGroupInventory,
} from './types'

export function inventoryForGroup(
  listings: BrowseListing[],
  group: ListingGroupDef,
  now = new Date(),
): ListingGroupInventory {
  const matched = listingsForMatch(listings, group.match)
  const rents = matched.map((listing) => listing.rentN).filter((n): n is number => n != null)
  return {
    listings: matched,
    count: matched.length,
    minRent: rents.length ? Math.min(...rents) : null,
    asOf: formatGroupAsOf(now),
  }
}

export function interpolateLead(group: ListingGroupDef, inventory: ListingGroupInventory): string {
  if (inventory.count === 0) {
    return group.emptyLead
      .replaceAll('{place}', group.place)
      .replaceAll('{noun}', group.noun)
      .replaceAll('{asOf}', inventory.asOf)
  }
  const noun = inventory.count === 1 ? group.noun.replace(/homes$/, 'home') : group.noun
  return group.answerLead
    .replaceAll('{count}', String(inventory.count))
    .replaceAll('{noun}', noun)
    .replaceAll('{place}', group.place)
    .replaceAll('{minRent}', inventory.minRent != null ? formatCad(inventory.minRent) : 'market rate')
    .replaceAll('{asOf}', inventory.asOf)
}
