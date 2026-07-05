// src/app/(public)/listings/page.tsx
// Public listings browse page — no auth required.
// Org context resolved from x-org-slug header (set by middleware from subdomain)
// or ?org= query param fallback (localhost dev).
import { headers } from 'next/headers'
import Link from 'next/link'
import { getOrgBySlug } from '@/lib/orgs'
import { createPublicClient } from '@/lib/supabase/public'

interface SearchParams {
  minRent?: string
  maxRent?: string
  beds?: string
  amenity?: string
}

interface Props {
  searchParams: Promise<SearchParams>
}

function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function ListingsPage({ searchParams }: Props) {
  const headersList = await headers()
  const slug = headersList.get('x-org-slug') ?? ''

  const org = await getOrgBySlug(slug)

  if (!org) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-800 mb-2">Listings not found</h1>
        <p className="text-stone-500">
          No rental listings found for this address. Please check the URL and try again.
        </p>
      </div>
    )
  }

  const params = await searchParams
  const minRent = params.minRent ? Number(params.minRent) : null
  const maxRent = params.maxRent ? Number(params.maxRent) : null
  const beds = params.beds ? parseInt(params.beds) : null
  const amenity = params.amenity?.trim().toLowerCase() ?? null

  const supabase = createPublicClient()
  const { data: listings } = await supabase
    .from('listings')
    .select(
      `id, listing_title, display_rent, highlights, available_from, status,
       units!unit_id(id, bedrooms, bathrooms, sq_footage, asking_rent, amenities,
         properties!property_id(id, street_address, city, province, photo_paths))`
    )
    .eq('status', 'published')
    .eq('org_id', org.id)

  // Type the joined result
  type ListingRow = NonNullable<typeof listings>[number] & {
    units: {
      id: string
      bedrooms: number
      bathrooms: number
      sq_footage: number | null
      asking_rent: number | null
      amenities: string[] | null
      properties: {
        id: string
        street_address: string
        city: string
        province: string
        photo_paths: string[] | null
      } | null
    } | null
  }

  let filtered: ListingRow[] = (listings ?? []) as ListingRow[]

  // Apply in-memory filters
  if (beds !== null && !isNaN(beds)) {
    filtered = filtered.filter((l) => l.units?.bedrooms === beds)
  }
  if (minRent !== null && !isNaN(minRent)) {
    filtered = filtered.filter((l) => {
      const rent = l.display_rent ?? l.units?.asking_rent ?? null
      return rent !== null && rent >= minRent
    })
  }
  if (maxRent !== null && !isNaN(maxRent)) {
    filtered = filtered.filter((l) => {
      const rent = l.display_rent ?? l.units?.asking_rent ?? null
      return rent !== null && rent <= maxRent
    })
  }
  if (amenity) {
    filtered = filtered.filter((l) =>
      l.units?.amenities?.some((a) => a.toLowerCase().includes(amenity))
    )
  }

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/org-assets`

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-800 mb-1">
        Available Rentals — {org.name}
      </h1>
      <p className="text-stone-500 mb-6 text-sm">
        {filtered.length} unit{filtered.length !== 1 ? 's' : ''} available
      </p>

      {/* Filter bar — server-side form, no JS required */}
      <form method="GET" className="mb-8 flex flex-wrap gap-3 items-end bg-stone-50 border border-stone-200 rounded-xl p-4">
        <input type="hidden" name="org" value={slug} />

        <div className="flex flex-col gap-1 min-w-[110px]">
          <label htmlFor="minRent" className="text-xs font-medium text-stone-600">
            Min rent (CAD)
          </label>
          <input
            id="minRent"
            name="minRent"
            type="number"
            defaultValue={params.minRent ?? ''}
            placeholder="e.g. 1000"
            className="h-9 rounded-lg border border-stone-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>

        <div className="flex flex-col gap-1 min-w-[110px]">
          <label htmlFor="maxRent" className="text-xs font-medium text-stone-600">
            Max rent (CAD)
          </label>
          <input
            id="maxRent"
            name="maxRent"
            type="number"
            defaultValue={params.maxRent ?? ''}
            placeholder="e.g. 2000"
            className="h-9 rounded-lg border border-stone-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>

        <div className="flex flex-col gap-1 min-w-[100px]">
          <label htmlFor="beds" className="text-xs font-medium text-stone-600">
            Bedrooms
          </label>
          <select
            id="beds"
            name="beds"
            defaultValue={params.beds ?? ''}
            className="h-9 rounded-lg border border-stone-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
          >
            <option value="">Any</option>
            <option value="0">Bachelor</option>
            <option value="1">1 bed</option>
            <option value="2">2 bed</option>
            <option value="3">3 bed</option>
            <option value="4">4+ bed</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[140px]">
          <label htmlFor="amenity" className="text-xs font-medium text-stone-600">
            Amenity
          </label>
          <input
            id="amenity"
            name="amenity"
            type="text"
            defaultValue={params.amenity ?? ''}
            placeholder="e.g. parking"
            className="h-9 rounded-lg border border-stone-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>

        <button
          type="submit"
          className="h-9 px-4 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 transition-colors"
        >
          Filter
        </button>

        {(params.minRent || params.maxRent || params.beds || params.amenity) && (
          <a
            href={`/listings${slug ? `?org=${slug}` : ''}`}
            className="h-9 px-4 rounded-lg border border-stone-300 text-stone-600 text-sm font-medium flex items-center hover:bg-stone-100 transition-colors"
          >
            Clear
          </a>
        )}
      </form>

      {/* Listings grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-stone-500">
          No units available at this time.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((listing) => {
            const unit = listing.units
            const property = unit?.properties
            const rent = listing.display_rent ?? unit?.asking_rent
            const firstPhoto =
              property?.photo_paths?.[0]
                ? `${storageBase}/${property.photo_paths[0]}`
                : null

            return (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}${slug ? `?org=${slug}` : ''}`}
                className="group block rounded-xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow bg-white"
              >
                {/* Photo */}
                <div className="relative h-44 bg-stone-100">
                  {firstPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={firstPhoto}
                      alt={listing.listing_title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-stone-300 text-4xl">
                      🏠
                    </div>
                  )}
                  {listing.available_from && (
                    <span className="absolute top-2 right-2 bg-white/90 text-stone-700 text-xs font-medium px-2 py-1 rounded-full">
                      Available {formatDate(listing.available_from)}
                    </span>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4">
                  <h2 className="font-semibold text-stone-800 text-sm leading-snug mb-1 line-clamp-2">
                    {listing.listing_title}
                  </h2>
                  {property && (
                    <p className="text-xs text-stone-500 mb-2">
                      {property.city}, {property.province}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-stone-600 mb-3">
                    {unit && (
                      <>
                        <span>{unit.bedrooms} bed</span>
                        <span className="text-stone-300">|</span>
                        <span>{unit.bathrooms} bath</span>
                        {unit.sq_footage && (
                          <>
                            <span className="text-stone-300">|</span>
                            <span>{unit.sq_footage} sq ft</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-stone-900">
                      {rent ? `${formatCAD(rent)}/mo` : 'Price on request'}
                    </span>
                    <span className="text-xs text-stone-500 group-hover:text-stone-800 transition-colors">
                      View listing →
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
