import Link from 'next/link'
import { InterestForm } from '@/components/listings/InterestForm'
import { HospitableDirectBookingWidget } from '@/components/listings/HospitableDirectBookingWidget'
import { ListingPhotoGallery } from '@/components/listings/ListingPhotoGallery'
import { SimilarListingsSection } from '@/components/landing/SimilarListingsCarousel'
import { PublicHeader } from '@/components/public/PublicHeader'
import { fontDisplay } from '@/lib/landing/typography'
import type { CityGroup } from '@/lib/listings/browse-types'
import { resolveParkingDisplay } from '@/lib/listings/browse-utils'

export type PropertyPublicUnit = {
  bedrooms: number | null
  bathrooms: number | null
  sq_footage: number | null
  amenities: string[] | null
  status: string | null
}

export type PropertyPublicProperty = {
  id: string
  slug: string | null
  street_address: string
  city: string
  province: string
  photo_paths: string[] | null
  property_type: string | null
  listing_brief?: unknown
}

export type PropertyPublicViewProps = {
  property: PropertyPublicProperty
  unit: PropertyPublicUnit | null
  photos: string[]
  /** Full-res URLs for hero + lightbox (index-aligned with photos). */
  photosFull?: string[]
  availabilityLabel: string
  carouselGroups: CityGroup[]
  orgSlug: string
  orgId: string
  /** Any listing for a unit on this property (incl. draft/unlisted), if one exists */
  linkedListingId?: string | null
  /** Hospitable Direct widget `data-property-id` when linked for short-term booking */
  hospitableWidgetPropertyId?: string | null
  /** Org-level Hospitable Direct site UUID */
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

export function PropertyPublicView({
  property,
  unit,
  photos,
  photosFull,
  availabilityLabel,
  carouselGroups,
  orgSlug,
  orgId,
  linkedListingId,
  hospitableWidgetPropertyId,
  hospitableSiteUuid,
  listingCardCopy,
}: PropertyPublicViewProps) {
  const street = property.street_address?.trim() || ''
  const city = property.city?.trim() || ''
  const provinceRaw = property.province?.trim() || ''
  const streetLine = street.split(',')[0]?.trim() || street
  const cityLine =
    city ||
    street
      .split(',')
      .map((p) => p.trim())
      .find(
        (p, i) =>
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
  const fullAddress = heroAddress || streetLine || 'Property'
  const homesHref = orgSlug && orgSlug !== 'canary' ? `/?org=${orgSlug}#homes` : '/#homes'
  const amenityList = Array.isArray(unit?.amenities) ? unit.amenities : []

  const briefParking =
    property.listing_brief &&
    typeof property.listing_brief === 'object' &&
    !Array.isArray(property.listing_brief)
      ? String((property.listing_brief as { parking?: unknown }).parking ?? '')
      : ''
  const parkingResolved = resolveParkingDisplay({
    briefParking,
    amenities: amenityList,
  })
  const parkingFromText = parkingResolved === '—' ? null : parkingResolved

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  const mapsQuery = encodeURIComponent(fullAddress)

  return (
    <>
      <PublicHeader overlay />

      <ListingPhotoGallery
        photos={photos}
        fullPhotos={photosFull}
        title={fullAddress}
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
        <p className="cpub-stat-pill cpub-listing-hero-eyebrow">{availabilityLabel}</p>
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
          {parkingFromText != null && (
            <div className="cpub-listing-hero-stat">
              {parkingFromText}
              <span>Parking</span>
            </div>
          )}
          {unit?.sq_footage != null && (
            <div className="cpub-listing-hero-stat">
              {unit.sq_footage}
              <span>Sq ft</span>
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
        <div
          style={{
            marginBottom: 32,
            padding: '16px 18px',
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--elev)',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: fontDisplay,
              fontWeight: 600,
              fontSize: 'clamp(18px, 2.4vw, 22px)',
              color: 'var(--text)',
            }}
          >
            {availabilityLabel}
          </p>
          <p style={{ margin: '8px 0 0', color: 'var(--dim)', fontSize: 14.5, lineHeight: 1.5 }}>
            This home isn&apos;t available for viewing right now. Tell us what you&apos;re looking
            for below, or browse other available homes.
          </p>
          <div style={{ marginTop: 14 }}>
            <a href="#interest-form" className="cpub-btn-primary" style={{ textDecoration: 'none' }}>
              Get on our list
            </a>
          </div>
        </div>

        {/* minmax(0,1fr) prevents Hospitable iframe / carousel min-content from blowing the column */}
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
          {hospitableSiteUuid && hospitableWidgetPropertyId ? (
            <HospitableDirectBookingWidget
              siteUuid={hospitableSiteUuid}
              propertyId={hospitableWidgetPropertyId}
            />
          ) : null}

          {amenityList.length > 0 && (
            <section style={{ minWidth: 0, maxWidth: '100%' }}>
              <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Amenities</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {amenityList.map((a, i) => (
                  <span key={i} className="cpub-amenity">
                    {a}
                  </span>
                ))}
              </div>
            </section>
          )}

          {fullAddress && mapsApiKey && (
            <section style={{ minWidth: 0, maxWidth: '100%' }}>
              <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Location</h2>
              <div style={{ overflow: 'hidden', borderRadius: 16, border: '1px solid var(--border)' }}>
                <iframe
                  title="Property location"
                  width="100%"
                  height="320"
                  style={{ border: 0, display: 'block', maxWidth: '100%' }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${mapsQuery}`}
                />
              </div>
            </section>
          )}

          <div className="cpub-forms-stack">
            <InterestForm
              orgId={orgId}
              listingId={linkedListingId}
              propertyId={property.id}
              propertyLabel={fullAddress}
              propertySlug={property.slug}
            />
          </div>

          <SimilarListingsSection groups={carouselGroups} copy={listingCardCopy} />
        </div>
      </main>
    </>
  )
}
