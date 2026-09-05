import Link from 'next/link'
import { InquiryForm } from '@/components/listings/InquiryForm'
import { InterestForm } from '@/components/listings/InterestForm'
import { HospitableDirectBookingWidget } from '@/components/listings/HospitableDirectBookingWidget'
import { ListingPhotoGallery } from '@/components/listings/ListingPhotoGallery'
import { SimilarListingsSection } from '@/components/landing/SimilarListingsCarousel'
import { PublicHeader } from '@/components/public/PublicHeader'
import { StaffEditDetailsLink } from '@/components/listings/StaffEditDetailsLink'
import { staffListingEditHref } from '@/lib/listings/staff-public-edit'
import { fontDisplay } from '@/lib/landing/typography'
import type { CityGroup } from '@/lib/listings/browse-types'
import { publicListingAmenityTags, resolveParkingDisplay } from '@/lib/listings/browse-utils'
import { formatListingLeaseEnd } from '@/lib/listings/public-property-page'
import { deriveTermTypeFromHighlights } from '@/lib/landing/listing-term'
import { bedsGroupPath, citySlugFromName } from '@/lib/listing-groups/city'
import { rentalsHref } from '@/lib/listing-groups/types'

function formatCAD(n: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n)
}

export type ListingDetailListing = {
  id: string
  org_id: string
  unit_id?: string | null
  listing_title: string
  listing_description: string | null
  highlights: string[] | null
  display_rent: number | null
  available_from: string | null
  available_until: string | null
  status: string
  slug?: string | null
  units: {
    bedrooms: number | null
    bathrooms: number | null
    sq_footage: number | null
    amenities: string[] | null
    asking_rent: number | null
    status?: string | null
    hospitable_widget_property_id?: string | null
    properties: {
      id: string
      street_address: string
      city: string
      province: string
      photo_paths: string[] | null
      listing_brief?: unknown
      property_type?: string | null
    } | null
  } | null
}

export type ListingDetailViewProps = {
  listing: ListingDetailListing
  listingPhotos: string[]
  /** Full-res URLs for hero + lightbox (index-aligned with listingPhotos). */
  listingPhotosFull?: string[]
  carouselGroups: CityGroup[]
  orgSlug: string
  /** Org-level Hospitable Direct site UUID when widget should render */
  hospitableSiteUuid?: string | null
  listingCardCopy: {
    tBed: string
    tBath: string
    tPark: string
    tAvailable: string
    longTerm: string
    midTerm: string
  }
}

/** Listing columns only. Hydrate units/properties via public_* views. */
export const LISTING_DETAIL_SELECT = `
  id,
  org_id,
  unit_id,
  slug,
  listing_title,
  listing_description,
  highlights,
  display_rent,
  available_from,
  available_until,
  status
`

export function ListingDetailView({
  listing,
  listingPhotos,
  listingPhotosFull,
  carouselGroups,
  orgSlug,
  hospitableSiteUuid,
  listingCardCopy,
}: ListingDetailViewProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unit = listing.units as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const property = unit?.properties as any
  const rent = listing.display_rent ?? unit?.asking_rent
  const street = (property?.street_address as string | undefined)?.trim() || ''
  const city = (property?.city as string | undefined)?.trim() || ''
  const provinceRaw = (property?.province as string | undefined)?.trim() || ''
  const streetLine = street.split(',')[0]?.trim() || street
  const cityLine =
    city ||
    street
      .split(',')
      .map((p: string) => p.trim())
      .find(
        (p: string, i: number) =>
          i > 0 &&
          !/^(NL|NS|NB|PE|QC|ON|MB|SK|AB|BC|YT|NT|NU)\b/i.test(p) &&
          !/^canada$/i.test(p) &&
          !/^[A-Z]\d[A-Z]/i.test(p),
      ) ||
    ''
  const provinceLine = (
    provinceRaw ||
    street.match(/\b(NL|NS|NB|PE|QC|ON|MB|SK|AB|BC|YT|NT|NU)\b/i)?.[1] ||
    ''
  )
    .replace(/\s+[A-Z]\d[A-Z].*$/i, '')
    .trim()
    .toUpperCase()
  const heroAddress = [streetLine, cityLine, provinceLine].filter(Boolean).join(', ')
  const fullAddress = heroAddress || listing.listing_title

  const rentalsIndexHref = rentalsHref('', orgSlug)
  const citySlug = citySlugFromName(city)
  const cityHubHref = citySlug ? rentalsHref(citySlug, orgSlug) : null
  const beds = typeof unit?.bedrooms === 'number' ? unit.bedrooms : null
  const bedsHubHref =
    beds != null && beds > 0
      ? rentalsHref(citySlug === 'st-johns' ? `st-johns/${bedsGroupPath(beds)}` : bedsGroupPath(beds), orgSlug)
      : null

  const availableLabel = listing.available_from
    ? new Date(listing.available_from).toLocaleDateString('en-CA', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null
  const leaseEndLabel = formatListingLeaseEnd(listing.available_until)
  const isMidTerm = deriveTermTypeFromHighlights(listing.highlights) === 'mid'

  const briefParking =
    property?.listing_brief &&
    typeof property.listing_brief === 'object' &&
    !Array.isArray(property.listing_brief)
      ? String((property.listing_brief as { parking?: unknown }).parking ?? '')
      : ''
  const parkingResolved = resolveParkingDisplay({
    briefParking,
    description: listing.listing_description,
    highlights: listing.highlights,
    amenities: (unit?.amenities as string[] | null) ?? null,
  })
  const parkingLabel = parkingResolved === '—' ? null : parkingResolved
  const amenityTags = publicListingAmenityTags({
    listingBrief: property?.listing_brief,
    amenities: (unit?.amenities as string[] | null) ?? null,
    description: listing.listing_description,
    highlights: listing.highlights,
  })

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  const mapsQuery = encodeURIComponent(fullAddress)
  const widgetPropertyId =
    typeof unit?.hospitable_widget_property_id === 'string'
      ? unit.hospitable_widget_property_id.trim()
      : ''

  return (
    <>
      <PublicHeader overlay />

      <ListingPhotoGallery
        photos={listingPhotos}
        fullPhotos={listingPhotosFull}
        title={listing.listing_title}
        topBar={
          <>
            <Link
              href={rentalsIndexHref}
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
            <StaffEditDetailsLink
              href={staffListingEditHref(listing.id)}
              orgId={listing.org_id}
            />
          </>
        }
      >
        <p className="cpub-stat-pill cpub-listing-hero-eyebrow">
          {isMidTerm ? 'Mid-term rental' : 'Available for rent'}
        </p>
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
          {isMidTerm && (
            <div className="cpub-listing-hero-stat">
              <span>Term</span>
              Mid-term
            </div>
          )}
          {availableLabel && (
            <div className="cpub-listing-hero-stat">
              <span>Available</span>
              {availableLabel}
            </div>
          )}
          {leaseEndLabel && (
            <div className="cpub-listing-hero-stat">
              <span>Lease ends</span>
              {leaseEndLabel}
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

      <main
        style={{
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: 1180,
          minWidth: 0,
          margin: '0 auto',
          padding: '40px clamp(20px, 4vw, 32px) 64px',
          overflowX: 'clip',
        }}
      >
        <nav aria-label="Breadcrumb" style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--dim)' }}>
          <Link href="/" style={{ color: 'var(--dim)' }}>Home</Link>
          {' / '}
          <Link href={rentalsIndexHref} style={{ color: 'var(--dim)' }}>Rentals</Link>
          {cityHubHref && city ? (
            <>
              {' / '}
              <Link href={cityHubHref} style={{ color: 'var(--dim)' }}>{city}</Link>
            </>
          ) : null}
          {bedsHubHref && beds != null ? (
            <>
              {' / '}
              <Link href={bedsHubHref} style={{ color: 'var(--dim)' }}>
                {beds >= 3 ? '3+ bedroom' : `${beds} bedroom`}
              </Link>
            </>
          ) : null}
        </nav>
        <div
          style={{
            display: 'grid',
            gap: 40,
            gridTemplateColumns: 'minmax(0, 1fr)',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'grid',
              gap: 40,
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            }}
          >
            <div style={{ minWidth: 0 }}>
              {hospitableSiteUuid && widgetPropertyId ? (
                <div style={{ marginBottom: 36 }}>
                  <HospitableDirectBookingWidget
                    siteUuid={hospitableSiteUuid}
                    propertyId={widgetPropertyId}
                  />
                </div>
              ) : null}

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
                  <p
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      color: 'var(--dim)',
                      lineHeight: 1.65,
                      fontSize: '15.5px',
                    }}
                  >
                    {listing.listing_description}
                  </p>
                </section>
              )}

              {listing.highlights && listing.highlights.length > 0 && (
                <section style={{ marginBottom: 36 }}>
                  <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Highlights</h2>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {listing.highlights.map((h: string, i: number) => (
                      <li
                        key={i}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          color: 'var(--dim)',
                          fontSize: '15px',
                        }}
                      >
                        <span style={{ color: 'var(--green)', fontWeight: 700, flex: 'none' }}>✓</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {amenityTags.length > 0 && (
                <section style={{ marginBottom: 36 }}>
                  <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Amenities</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {amenityTags.map((tag) => (
                      <span key={tag} className="cpub-amenity">
                        {tag}
                      </span>
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
                  <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--dim)' }}>
                    Available {availableLabel}
                  </p>
                )}
                {isMidTerm && (
                  <p style={{ margin: availableLabel ? '6px 0 0' : '8px 0 0', fontSize: 14, fontWeight: 650, color: 'var(--text)' }}>
                    Mid-term — not a long-term tenancy
                  </p>
                )}
                {leaseEndLabel && (
                  <p
                    style={{
                      margin: availableLabel || isMidTerm ? '4px 0 0' : '8px 0 0',
                      fontSize: 15,
                      fontWeight: 650,
                      color: 'var(--text)',
                    }}
                  >
                    Lease ends {leaseEndLabel}
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                  <a href="#inquiry-form" className="cpub-btn-primary" style={{ textDecoration: 'none' }}>
                    Request a viewing
                  </a>
                </div>
              </div>
            </aside>
          </div>

          <div className="cpub-forms-stack">
            <InquiryForm listingId={listing.id} orgId={listing.org_id} />
            <InterestForm
              orgId={listing.org_id}
              listingId={listing.id}
              propertyId={property?.id ?? null}
              propertyLabel={fullAddress}
            />
          </div>

          <SimilarListingsSection groups={carouselGroups} copy={listingCardCopy} />
        </div>
      </main>
    </>
  )
}
