// src/app/(public)/listings/[id]/page.tsx
// Public listing detail page — shows full listing info with inquiry and application forms.
// Unauthenticated access. Org resolved from ?org=<slug> query param (D-05).
// Styled to match the landing page branding (Instrument Sans/Serif + IBM Plex Mono,
// warm palette, yellow accent) — see src/components/landing/landing-styles.css.
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { InquiryForm } from '@/components/listings/InquiryForm'
import { ApplicationForm } from '@/components/listings/ApplicationForm'
import { createPublicClient } from '@/lib/supabase/public'
import { getOrgBySlug } from '@/lib/orgs'
import { headers } from 'next/headers'
import { CARD_PHOTOS } from '@/lib/landing/content'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ org?: string }>
}

const MONO = "var(--font-ibm-plex-mono), 'IBM Plex Mono', monospace"
const SERIF = "var(--font-instrument-serif), 'Instrument Serif', serif"

/** Photo paths may be full URLs or storage-relative keys (browse cards prefix
 *  the storage base — mirror that here so the hero always resolves). */
function resolvePhoto(path: string): string {
  if (/^https?:\/\//.test(path) || path.startsWith('/')) return path
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/org-assets/${path}`
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

  const photos: string[] = (property?.photo_paths ?? []).map(resolvePhoto)
  // The landing page cards fall back to curated stock photos when a property
  // has no uploaded photos — mirror that here (stable per listing id) so the
  // hero never renders empty.
  const fallbackPhoto =
    CARD_PHOTOS[
      [...listing.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % CARD_PHOTOS.length
    ]
  const heroPhoto = photos[0] ?? fallbackPhoto

  const availableLabel = listing.available_from
    ? new Date(listing.available_from).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null
  const availableShort = listing.available_from
    ? new Date(listing.available_from).toLocaleDateString('en-CA', {
        month: 'short',
        day: 'numeric',
      })
    : null

  const stats = [
    unit?.bedrooms != null ? { value: String(unit.bedrooms), label: unit.bedrooms === 1 ? 'bedroom' : 'bedrooms' } : null,
    unit?.bathrooms != null ? { value: String(unit.bathrooms), label: unit.bathrooms === 1 ? 'bathroom' : 'bathrooms' } : null,
    unit?.sq_footage ? { value: Number(unit.sq_footage).toLocaleString(), label: 'sq ft' } : null,
    availableShort ? { value: availableShort, label: 'available' } : null,
  ].filter((s): s is { value: string; label: string } => s !== null)

  return (
    <div>
      {/* ——— Hero ——— */}
      <section
        style={{
          position: 'relative',
          minHeight: 'min(78vh, 680px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          overflow: 'hidden',
          background: 'var(--ink)',
          color: 'var(--ink-text)',
        }}
      >
        {heroPhoto && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url('${heroPhoto}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 45%',
            }}
          />
        )}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(24,19,12,.52) 0%, rgba(24,19,12,.18) 40%, rgba(24,19,12,.42) 66%, rgba(24,19,12,.88) 100%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            maxWidth: 1180,
            width: '100%',
            margin: '0 auto',
            padding: '150px clamp(16px, 4vw, 26px) 40px',
          }}
        >
          <Link
            href="/#homes"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              color: 'rgba(244,239,230,.85)',
              fontFamily: MONO,
              fontSize: '11.5px',
              letterSpacing: '.14em',
              marginBottom: 18,
            }}
          >
            ← ALL HOMES
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--yellow)', boxShadow: '0 0 0 4px rgba(240,196,69,.25)' }} />
            <span style={{ fontFamily: MONO, fontSize: '11.5px', letterSpacing: '.14em', color: 'rgba(244,239,230,.85)', textTransform: 'uppercase' }}>
              For rent{property?.city ? ` · ${property.city}, ${property.province}` : ''}
            </span>
          </div>

          <h1
            style={{
              margin: '0 0 10px',
              fontSize: 'clamp(34px, 5.6vw, 68px)',
              fontWeight: 700,
              letterSpacing: '-.035em',
              lineHeight: 1.02,
              maxWidth: '18ch',
            }}
          >
            {listing.listing_title}
          </h1>
          {fullAddress && (
            <p style={{ margin: 0, fontSize: 'clamp(15px, 1.5vw, 18px)', color: 'rgba(244,239,230,.9)' }}>{fullAddress}</p>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 22,
              flexWrap: 'wrap',
              borderTop: '1px solid rgba(244,239,230,.22)',
              marginTop: 26,
              paddingTop: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap' }}>
              {stats.map((stat) => (
                <div key={stat.label} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 22, letterSpacing: '-.02em' }}>{stat.value}</span>
                  <span style={{ color: 'var(--ink-dim)', fontSize: 13 }}>{stat.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              {rent ? (
                <>
                  <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 'clamp(24px, 3vw, 34px)', letterSpacing: '-.02em', color: 'var(--yellow)' }}>
                    ${Number(rent).toLocaleString()}
                  </span>
                  <span style={{ color: 'rgba(244,239,230,.75)', fontSize: 15 }}>/mo</span>
                </>
              ) : (
                <span style={{ color: 'rgba(244,239,230,.85)', fontWeight: 600 }}>Contact for pricing</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ——— Body ——— */}
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '34px clamp(16px, 4vw, 26px) 80px' }}>
        <div className="grid gap-10 lg:[grid-template-columns:minmax(0,1.9fr)_minmax(280px,1fr)]">
          {/* Main column */}
          <div className="min-w-0 space-y-10">
            {/* Extra photos */}
            {photos.length > 1 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.slice(1, 5).map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={src}
                    alt={`${listing.listing_title} — photo ${i + 2}`}
                    className="cpub-thumb h-28 w-full rounded-2xl object-cover sm:h-32"
                    style={{ border: '1px solid var(--border)' }}
                  />
                ))}
              </div>
            )}

            {/* Description */}
            {listing.listing_description && (
              <section>
                <div style={{ fontFamily: MONO, fontSize: '11.5px', letterSpacing: '.14em', color: 'var(--faint)', marginBottom: 12 }}>
                  ABOUT THIS HOME
                </div>
                <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.1 }}>
                  Life at <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, color: 'var(--accent)' }}>this address</em>
                </h2>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--dim)', lineHeight: 1.65, maxWidth: '68ch' }}>
                  {listing.listing_description}
                </p>
              </section>
            )}

            {/* Highlights */}
            {listing.highlights && listing.highlights.length > 0 && (
              <section>
                <div style={{ fontFamily: MONO, fontSize: '11.5px', letterSpacing: '.14em', color: 'var(--faint)', marginBottom: 12 }}>
                  HIGHLIGHTS
                </div>
                <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2">
                  {listing.highlights.map((h: string, i: number) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5"
                      style={{ background: 'var(--elev)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px', color: 'var(--text)', fontSize: '14.5px', fontWeight: 600 }}
                    >
                      <span aria-hidden="true" style={{ flex: 'none', color: 'var(--green)', fontWeight: 700 }}>✓</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Amenities */}
            {unit?.amenities && unit.amenities.length > 0 && (
              <section>
                <div style={{ fontFamily: MONO, fontSize: '11.5px', letterSpacing: '.14em', color: 'var(--faint)', marginBottom: 12 }}>
                  AMENITIES
                </div>
                <div className="flex flex-wrap gap-2">
                  {unit.amenities.map((a: string, i: number) => (
                    <span
                      key={i}
                      style={{ borderRadius: 999, border: '1px solid var(--border2)', background: 'var(--panel)', padding: '7px 15px', fontSize: '13.5px', fontWeight: 600, color: 'var(--dim)' }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Map */}
            {fullAddress && mapsApiKey && (
              <section>
                <div style={{ fontFamily: MONO, fontSize: '11.5px', letterSpacing: '.14em', color: 'var(--faint)', marginBottom: 12 }}>
                  LOCATION
                </div>
                <div style={{ overflow: 'hidden', borderRadius: 20, border: '1px solid var(--border)' }}>
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

          {/* Sidebar */}
          <div className="min-w-0">
            <div
              className="lg:sticky lg:top-24"
              style={{ background: 'var(--elev)', border: '1px solid var(--border)', borderRadius: 22, padding: '26px 26px 24px', boxShadow: 'var(--shadow)' }}
            >
              <div style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
                Monthly rent
              </div>
              {rent ? (
                <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 34, letterSpacing: '-.02em', color: 'var(--text)' }}>
                    ${Number(rent).toLocaleString()}
                  </span>
                  <span style={{ color: 'var(--dim)', fontSize: 15 }}>/mo</span>
                </p>
              ) : (
                <p style={{ margin: 0, color: 'var(--dim)', fontWeight: 600 }}>Contact for pricing</p>
              )}
              {availableLabel && (
                <p style={{ margin: '8px 0 0', fontSize: '13.5px', color: 'var(--dim)' }}>
                  Available <b style={{ color: 'var(--text)' }}>{availableLabel}</b>
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                <a
                  href="#inquiry-form"
                  className="cpub-btn-yellow"
                  style={{ display: 'flex', minHeight: 48, alignItems: 'center', justifyContent: 'center', textDecoration: 'none', padding: '12px 22px', fontSize: '15px', boxShadow: '0 10px 30px rgba(240,196,69,.3)' }}
                >
                  Request a showing
                </a>
                <a href="#apply-form" className="cpub-btn-outline">
                  Apply for this unit
                </a>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 14, fontSize: '12.5px', color: 'var(--faint)', lineHeight: 1.5 }}>
                Every home is verified by our local team. Questions?{' '}
                <a href="mailto:info@canarypm.ca" style={{ color: 'var(--accent)', fontWeight: 600 }}>Email us</a> or call{' '}
                <a href="tel:+17092009626" style={{ color: 'var(--accent)', fontWeight: 600 }}>(709) 200-9626</a>.
              </div>
            </div>
          </div>
        </div>

        {/* ——— Forms ——— */}
        <div style={{ marginTop: 70 }}>
          <div style={{ fontFamily: MONO, fontSize: '11.5px', letterSpacing: '.14em', color: 'var(--faint)', marginBottom: 12 }}>
            NEXT STEPS
          </div>
          <h2 style={{ margin: '0 0 22px', fontSize: 'clamp(26px, 3.4vw, 40px)', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.05 }}>
            Make it <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, color: 'var(--accent)' }}>yours</em>
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <InquiryForm listingId={listing.id} orgId={listing.org_id} />
            <ApplicationForm listingId={listing.id} orgId={listing.org_id} />
          </div>
        </div>
      </div>
    </div>
  )
}
