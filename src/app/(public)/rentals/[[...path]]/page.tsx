import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { ListingGroupPage } from '@/components/listing-groups/ListingGroupPage'
import { getLandingCopy } from '@/lib/landing/content'
import { getPublishedListings } from '@/lib/landing/get-published-listings'
import {
  listingGroupByPath,
  listingGroupPathFromSegments,
} from '@/lib/listing-groups/registry'
import { listingGroupJsonLd } from '@/lib/listing-groups/schema'
import { inventoryForGroup } from '@/lib/listing-groups/stats'
import { formatCad, rentalsHref } from '@/lib/listing-groups/types'
import { publicShareOrigin } from '@/lib/listings/public-share-metadata'
import { getOrgBySlug } from '@/lib/orgs'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface PageProps {
  params: Promise<{ path?: string[] }>
  searchParams: Promise<{ org?: string }>
}

function usableOrgSlug(slug: string | null | undefined): string | null {
  const value = slug?.trim() ?? ''
  if (!value) return null
  if (/^\d/.test(value)) return null
  if (value === 'localhost' || value === 'www' || value === 'app') return null
  return value
}

async function resolveOrgSlug(orgSlugParam?: string): Promise<string> {
  const headersList = await headers()
  return (
    usableOrgSlug(orgSlugParam) ||
    usableOrgSlug(headersList.get('x-org-slug')) ||
    process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ||
    'canary'
  )
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { path: segments } = await params
  const { org: orgSlugParam } = await searchParams
  const group = listingGroupByPath(listingGroupPathFromSegments(segments))
  if (!group) return { title: 'Rentals | Canary PM' }

  const orgSlug = await resolveOrgSlug(orgSlugParam)
  const listings = await getPublishedListings(orgSlug)
  const inventory = inventoryForGroup(listings, group)
  const origin = publicShareOrigin()
  const canonical = `${origin}${rentalsHref(group.path)}`
  const description =
    inventory.count > 0 && inventory.minRent != null
      ? `${group.description} ${inventory.count} listed from ${formatCad(inventory.minRent)} as of ${inventory.asOf}.`
      : group.description

  return {
    title: group.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: group.title,
      description,
      url: canonical,
      siteName: 'Canary PM',
      type: 'website',
    },
  }
}

export default async function RentalsGroupPage({ params, searchParams }: PageProps) {
  const { path: segments } = await params
  const { org: orgSlugParam } = await searchParams
  const group = listingGroupByPath(listingGroupPathFromSegments(segments))
  if (!group) notFound()

  const orgSlug = await resolveOrgSlug(orgSlugParam)
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  const listings = await getPublishedListings(orgSlug)
  const inventory = inventoryForGroup(listings, group)
  const copy = getLandingCopy('en')
  const jsonLd = listingGroupJsonLd(group, inventory)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ListingGroupPage
        group={group}
        inventory={inventory}
        orgId={org.id}
        orgSlug={orgSlug}
        cardCopy={{
          tBed: copy.tBed,
          tBath: copy.tBath,
          tPark: copy.tPark,
          tAvailable: copy.tAvailable,
          longTerm: copy.longTerm,
          midTerm: copy.midTerm,
        }}
      />
    </>
  )
}
