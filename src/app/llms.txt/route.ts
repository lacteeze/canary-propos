import { getPublishedListings } from '@/lib/landing/get-published-listings'
import { LISTING_GROUPS } from '@/lib/listing-groups/registry'
import { inventoryForGroup } from '@/lib/listing-groups/stats'
import { formatCad, formatGroupAsOf, rentalsHref } from '@/lib/listing-groups/types'
import { publicShareOrigin } from '@/lib/listings/public-share-metadata'

export const dynamic = 'force-dynamic'

export async function GET() {
  const origin = publicShareOrigin()
  const listings = await getPublishedListings()
  const asOf = formatGroupAsOf()
  const lines = [
    '# Canary Property Management',
    '>',
    `> Long-term rentals and property management in St. John's, Newfoundland. Inventory as of ${asOf}.`,
    '',
    `Homepage: ${origin}/`,
    `All rentals: ${origin}/rentals`,
    '',
    '## Rental hubs',
  ]

  for (const group of LISTING_GROUPS) {
    const inventory = inventoryForGroup(listings, group)
    const rent =
      inventory.minRent != null ? ` from ${formatCad(inventory.minRent)}/mo` : ''
    lines.push(
      `- [${group.h1}](${origin}${rentalsHref(group.path)}): ${inventory.count} listed${rent}`,
    )
  }

  lines.push('', '## Contact', '- Email: leasing@canarypm.ca', '- Phone: +1-709-200-9626')

  return new Response(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
