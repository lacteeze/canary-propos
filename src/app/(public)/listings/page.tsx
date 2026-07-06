// src/app/(public)/listings/page.tsx
// Public listings browse page — no auth required.
// Org context resolved from x-org-slug header (set by middleware from subdomain)
// or ?org= query param fallback (localhost dev).
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { Instrument_Sans } from 'next/font/google'
import { ListingsBrowse } from '@/components/listings/ListingsBrowse'
import { getOrgBySlug } from '@/lib/orgs'
import {
  countLabel,
  filterListings,
  groupListingsByCity,
  mapListingRow,
  parseBrowseFilters,
  sortListings,
  type ListingRow,
} from '@/lib/listings/browse-utils'
import { createPublicClient } from '@/lib/supabase/public'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
})

interface SearchParams {
  org?: string
  q?: string
  term?: string
  beds?: string
  price?: string
  pets?: string
  sort?: string
}

interface Props {
  searchParams: Promise<SearchParams>
}

async function ListingsContent({ searchParams }: Props) {
  const headersList = await headers()
  const params = await searchParams
  const slug =
    params.org ||
    headersList.get('x-org-slug') ||
    process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ||
    'canary'

  const org = await getOrgBySlug(slug)

  if (!org) {
    return (
      <div className="py-16 text-center">
        <h1 className="mb-2 text-2xl font-semibold text-stone-800">Listings not found</h1>
        <p className="text-stone-500">
          No rental listings found for this address. Please check the URL and try again.
        </p>
      </div>
    )
  }

  const filters = parseBrowseFilters(params)

  const supabase = createPublicClient()
  const { data: listings } = await supabase
    .from('listings')
    .select(
      `id, listing_title, listing_description, display_rent, highlights, available_from, status, created_at,
       units!unit_id(id, bedrooms, bathrooms, asking_rent, amenities,
         properties!property_id(id, street_address, city, province, photo_paths))`
    )
    .eq('status', 'published')
    .eq('org_id', org.id)

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/org-assets`
  const orgQuery = slug ? `?org=${slug}` : ''
  const staysHref = slug ? `/?org=${slug}#stays` : '/#stays'

  const allListings = (listings ?? []).map((row, index) =>
    mapListingRow(row as ListingRow, storageBase, orgQuery, index)
  )

  const filtered = sortListings(filterListings(allListings, filters), filters.sort)
  const groups = groupListingsByCity(filtered)

  return (
    <ListingsBrowse
      orgSlug={slug}
      filters={filters}
      groups={groups}
      filteredCount={filtered.length}
      totalCount={allListings.length}
      countLabel={countLabel(filtered.length, allListings.length)}
      staysHref={staysHref}
    />
  )
}

export default function ListingsPage(props: Props) {
  return (
    <div
      className={instrumentSans.variable}
      style={{ fontFamily: 'var(--font-instrument-sans), system-ui, sans-serif' }}
    >
      <Suspense
        fallback={
          <div className="py-16 text-center text-stone-500">Loading listings…</div>
        }
      >
        <ListingsContent {...props} />
      </Suspense>
    </div>
  )
}
