// src/app/(public)/listings/[id]/page.tsx
// Public listing detail page — shows full listing info with inquiry and application forms.
// Unauthenticated access. Org resolved from ?org=<slug> query param (D-05).
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { InquiryForm } from '@/components/listings/InquiryForm'
import { ApplicationForm } from '@/components/listings/ApplicationForm'
import { createPublicClient } from '@/lib/supabase/public'
import { getOrgBySlug } from '@/lib/orgs'
import { headers } from 'next/headers'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ org?: string }>
}

export default async function ListingDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { org: orgSlugParam } = await searchParams

  // Resolve org from x-org-slug header (set by middleware from subdomain) or ?org= param
  const headersList = await headers()
  const orgSlug = headersList.get('x-org-slug') || orgSlugParam || ''
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  const supabase = createPublicClient()

  // Fetch listing with unit + property data — scoped to org for multi-tenant safety (T-03-11)
  const { data: listing } = await supabase
    .from('listings')
    .select(`
      id,
      org_id,
      listing_title,
      listing_description,
      highlights,
      display_rent,
      available_from,
      status,
      units (
        bedrooms,
        bathrooms,
        sq_footage,
        amenities,
        asking_rent,
        properties (
          street_address,
          city,
          province,
          photo_paths
        )
      )
    `)
    .eq('id', id)
    .eq('org_id', org.id)
    .eq('status', 'published')
    .single()

  if (!listing) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unit = listing.units as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const property = unit?.properties as any
  const rent = listing.display_rent ?? unit?.asking_rent
  const fullAddress = property
    ? `${property.street_address}, ${property.city}, ${property.province}`
    : ''

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  const mapsQuery = encodeURIComponent(fullAddress)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Back link */}
      <Link
        href={`/listings${orgSlug ? `?org=${orgSlug}` : ''}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All listings
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photos */}
          {property?.photo_paths?.length > 0 ? (
            <div className="overflow-hidden rounded-xl bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={property.photo_paths[0]}
                alt={listing.listing_title}
                className="h-72 w-full object-cover sm:h-96"
              />
              {property.photo_paths.length > 1 && (
                <div className="flex gap-2 overflow-x-auto p-2">
                  {property.photo_paths.slice(1, 5).map((src: string, i: number) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt={`Photo ${i + 2}`}
                      className="h-20 w-28 flex-shrink-0 rounded-md object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-xl bg-stone-100">
              <svg className="h-14 w-14 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9.75L12 3l9 6.75V21H3V9.75z" />
              </svg>
            </div>
          )}

          {/* Title + address */}
          <div>
            <h1 className="text-2xl font-bold text-stone-900">{listing.listing_title}</h1>
            {fullAddress && (
              <p className="mt-1 text-stone-500">{fullAddress}</p>
            )}
          </div>

          {/* Unit details */}
          <div className="flex flex-wrap gap-4 rounded-xl border border-stone-200 bg-white p-4">
            {unit?.bedrooms != null && (
              <div className="text-center">
                <p className="text-xl font-bold text-stone-900">{unit.bedrooms}</p>
                <p className="text-xs text-stone-500">Bedrooms</p>
              </div>
            )}
            {unit?.bathrooms != null && (
              <div className="text-center">
                <p className="text-xl font-bold text-stone-900">{unit.bathrooms}</p>
                <p className="text-xs text-stone-500">Bathrooms</p>
              </div>
            )}
            {unit?.sq_footage && (
              <div className="text-center">
                <p className="text-xl font-bold text-stone-900">{unit.sq_footage}</p>
                <p className="text-xs text-stone-500">Sq ft</p>
              </div>
            )}
            {listing.available_from && (
              <div className="text-center">
                <p className="text-xl font-bold text-stone-900">
                  {new Date(listing.available_from).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                </p>
                <p className="text-xs text-stone-500">Available</p>
              </div>
            )}
          </div>

          {/* Description */}
          {listing.listing_description && (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-stone-900">About this unit</h2>
              <p className="whitespace-pre-wrap text-stone-600 leading-relaxed">
                {listing.listing_description}
              </p>
            </div>
          )}

          {/* Highlights */}
          {listing.highlights && listing.highlights.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-stone-900">Highlights</h2>
              <ul className="space-y-1">
                {listing.highlights.map((h: string, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-stone-600">
                    <svg className="h-4 w-4 flex-shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.293 9.879a1 1 0 111.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Amenities */}
          {unit?.amenities && unit.amenities.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-stone-900">Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {unit.amenities.map((a: string, i: number) => (
                  <span key={i} className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-sm text-stone-700">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Map */}
          {fullAddress && mapsApiKey && (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-stone-900">Location</h2>
              <div className="overflow-hidden rounded-xl">
                <iframe
                  title="Property location"
                  width="100%"
                  height="300"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${mapsQuery}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Rent card */}
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            {rent ? (
              <p className="text-3xl font-bold text-stone-900">
                ${Number(rent).toLocaleString()}
                <span className="text-base font-normal text-stone-500">/mo</span>
              </p>
            ) : (
              <p className="text-stone-500">Contact for pricing</p>
            )}
            {listing.available_from && (
              <p className="mt-1 text-sm text-stone-500">
                Available {new Date(listing.available_from).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}

            {/* CTA buttons */}
            <div className="mt-4 flex flex-col gap-2">
              <a
                href="#inquiry-form"
                className="flex min-h-11 items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Request a showing
              </a>
              <a
                href="#apply-form"
                className="flex min-h-11 items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-50"
              >
                Apply for this unit
              </a>
            </div>
          </div>

          {/* Sticky forms on mobile scroll to them */}
        </div>
      </div>

      {/* Forms section — full width below the grid, anchored */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <InquiryForm listingId={listing.id} orgId={listing.org_id} />
        <ApplicationForm listingId={listing.id} orgId={listing.org_id} />
      </div>
    </div>
  )
}
