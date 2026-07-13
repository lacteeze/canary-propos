// src/app/(public)/listings/[id]/page.tsx
// Public listing detail — hero photo, landing-page branding, inquiry + application forms.
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { InquiryForm } from '@/components/listings/InquiryForm'
import { ApplicationForm } from '@/components/listings/ApplicationForm'
import { ListingPhotoGallery } from '@/components/listings/ListingPhotoGallery'
import { SimilarListingsSection } from '@/components/landing/SimilarListingsCarousel'
import { PublicHeader } from '@/components/public/PublicHeader'
import { getLandingCopy } from '@/lib/landing/content'
import { getPublishedListings } from '@/lib/landing/get-published-listings'
import { fontDisplay } from '@/lib/landing/typography'
import { getDetailPageCarouselGroups } from '@/lib/listings/browse-utils'
import { createPublicClient } from '@/lib/supabase/public'
import { getOrgBySlug } from '@/lib/orgs'
import { headers } from 'next/headers'
import { getListingPhotoPathsForProperty } from '@/lib/storage/property-listing-media'
import { resolveListingGalleryPhotos } from '@/lib/storage/listing-photos'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ org?: string }>
}

function formatCAD(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
}

export default async function ListingDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { org: orgSlugParam } = await searchParams

  const headersList = await headers()
  const orgSlug = headersList.get('x-org-slug') || orgSlugParam || process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG || 'canary'
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  const supabase = createPublicClient()

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
          id,
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
  // street_address often already includes city/province/postal — build a clean display line
  const street = (property?.street_address as string | undefined)?.trim() || ''
  const city = (property?.city as string | undefined)?.trim() || ''
  const provinceRaw = (property?.province as string | undefined)?.trim() || ''
  const streetLine = street.split(',')[0]?.trim() || street
  const cityLine =
    city ||
    street
      .split(',')
      .map((p: string) => p.trim())
      .find((p: string, i: number) => i > 0 && !/^(NL|NS|NB|PE|QC|ON|MB|SK|AB|BC|YT|NT|NU)\b/i.test(p) && !/^canada$/i.test(p) && !/^[A-Z]\d[A-Z]/i.test(p)) ||
    ''
  const provinceLine = (provinceRaw || street.match(/\b(NL|NS|NB|PE|QC|ON|MB|SK|AB|BC|YT|NT|NU)\b/i)?.[1] || '')
    .replace(/\s+[A-Z]\d[A-Z].*$/i, '')
    .trim()
    .toUpperCase()
  const heroAddress = [streetLine, cityLine, provinceLine].filter(Boolean).join(', ')
  const fullAddress = heroAddress || listing.listing_title

  const fromMedia = property?.id ? await getListingPhotoPathsForProperty(property.id) : []
  const photoPaths: string[] =
    fromMedia.length > 0 ? fromMedia : (property?.photo_paths ?? [])
  const { all: listingPhotos } = await resolveListingGalleryPhotos(
    photoPaths,
    id.charCodeAt(0)
  )

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  const mapsQuery = encodeURIComponent(fullAddress)
  const homesHref = orgSlug && orgSlug !== 'canary' ? `/?org=${orgSlug}#homes` : '/#homes'

  const availableLabel = listing.available_from
    ? new Date(listing.available_from).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const parkingFromText = (() => {
    const amenities = (unit?.amenities as string[] | null) ?? []
    const amenityHit = amenities.find((a) => /\d+\s*parking|parking\s*[:\-]?\s*\d+/i.test(a))
    if (amenityHit) {
      const m = amenityHit.match(/(\d+)/)
      if (m) return m[1]
    }
    const text = [listing.listing_description, ...(listing.highlights ?? []), ...amenities].filter(Boolean).join(' ')
    const match = text.match(/(\d+)\s*parking|parking\s*[:\-]?\s*(\d+)/i)
    if (match) return match[1] || match[2]
    if (/parking/i.test(text)) return '1'
    return null
  })()
  const parkingLabel = parkingFromText

  const listingCity = property?.city ?? "St. John's"
  const allPublished = await getPublishedListings(orgSlug)
  const carouselGroups = getDetailPageCarouselGroups(allPublished, id, listingCity)
  const cardCopy = getLandingCopy('en')
  const listingCardCopy = {
    tBed: cardCopy.tBed,
    tBath: cardCopy.tBath,
    tPark: cardCopy.tPark,
    longTerm: cardCopy.longTerm,
    midTerm: cardCopy.midTerm,
  }

  return (
    <>
      <PublicHeader overlay />

      <ListingPhotoGallery
        photos={listingPhotos}
        title={listing.listing_title}
        topBar={
          <Link
            href={homesHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textDecoration: 'none',
              color: 'rgba(244,239,230,.85)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ← All available homes
          </Link>
        }
      >
        <p className="cpub-stat-pill cpub-listing-hero-eyebrow">Available for rent</p>
        <h1 className="cpub-listing-hero-title">{heroAddress}</h1>

        <div className="cpub-listing-hero-meta">
          {unit?.bedrooms != null && (
            <div className="cpub-listing-hero-stat">
              {unit.bedrooms}
              <span>Beds</span>
            </div>
          )}
          {unit?.bathrooms != null && (
            <div className="cpub-listing-hero-stat">
              {String(unit.bathrooms).replace(/\.0$/, '')}
              <span>Baths</span>
            </div>
          )}
          {parkingLabel != null && (
            <div className="cpub-listing-hero-stat">
              {parkingLabel}
              <span>Parking</span>
            </div>
          )}
          {unit?.sq_footage && (
            <div className="cpub-listing-hero-stat">
              {unit.sq_footage}
              <span>Sq ft</span>
            </div>
          )}
          {availableLabel && (
            <div className="cpub-listing-hero-stat">
              <span>Available</span>
              {availableLabel}
            </div>
          )}
          {rent != null && (
            <div className="cpub-listing-hero-price">
              {formatCAD(Number(rent))}
              <span>/mo</span>
            </div>
          )}
        </div>
      </ListingPhotoGallery>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '40px clamp(20px, 4vw, 32px) 64px' }}>
        <div style={{ display: 'grid', gap: 40, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div style={{ display: 'grid', gap: 40, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
            {/* Main column */}
            <div style={{ minWidth: 0 }}>
              {listing.listing_description && (
                <section style={{ marginBottom: 36 }}>
                  <h2
                    style={{
                      margin: '0 0 14px',
                      fontFamily: fontDisplay,
                      fontStyle: 'normal',
                      fontWeight: 600,
                      fontSize: 'clamp(22px, 3vw, 28px)',
                      color: 'var(--text)',
                    }}
                  >
                    About this home
                  </h2>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--dim)', lineHeight: 1.65, fontSize: '15.5px' }}>
                    {listing.listing_description}
                  </p>
                </section>
              )}

              {listing.highlights && listing.highlights.length > 0 && (
                <section style={{ marginBottom: 36 }}>
                  <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Highlights</h2>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {listing.highlights.map((h: string, i: number) => (
                      <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--dim)', fontSize: '15px' }}>
                        <span style={{ color: 'var(--green)', fontWeight: 700, flex: 'none' }}>✓</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {unit?.amenities && unit.amenities.length > 0 && (
                <section style={{ marginBottom: 36 }}>
                  <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Amenities</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {unit.amenities.map((a: string, i: number) => (
                      <span key={i} className="cpub-amenity">{a}</span>
                    ))}
                  </div>
                </section>
              )}

              {fullAddress && mapsApiKey && (
                <section>
                  <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Location</h2>
                  <div style={{ overflow: 'hidden', borderRadius: 16, border: '1px solid var(--border)' }}>
                    <iframe
                      title="Property location"
                      width="100%"
                      height="320"
                      style={{ border: 0, display: 'block' }}
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${mapsQuery}`}
                    />
                  </div>
                </section>
              )}
            </div>

            {/* Sticky sidebar — desktop */}
            <aside style={{ minWidth: 0 }}>
              <div
                style={{
                  position: 'sticky',
                  top: 88,
                  background: 'var(--elev)',
                  border: '1px solid var(--border)',
                  borderRadius: 18,
                  padding: 24,
                  boxShadow: 'var(--shadow)',
                }}
              >
                {rent != null ? (
                  <p style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: '-.02em' }}>
                    {formatCAD(Number(rent))}
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>/mo</span>
                  </p>
                ) : (
                  <p style={{ margin: 0, color: 'var(--dim)' }}>Contact for pricing</p>
                )}
                {availableLabel && (
                  <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--dim)' }}>Available {availableLabel}</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                  <a href="#inquiry-form" className="cpub-btn-primary" style={{ textDecoration: 'none' }}>
                    Request a showing
                  </a>
                  <a href="#apply-form" className="cpub-btn-outline">
                    Apply for this unit
                  </a>
                </div>
              </div>
            </aside>
          </div>

          <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
            <InquiryForm listingId={listing.id} orgId={listing.org_id} />
            <ApplicationForm listingId={listing.id} orgId={listing.org_id} />
          </div>

          <SimilarListingsSection groups={carouselGroups} copy={listingCardCopy} />
        </div>
      </main>
    </>
  )
}
