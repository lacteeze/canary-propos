// src/app/(public)/listings/[id]/page.tsx
// Public listing detail — hero photo, landing-page branding, inquiry + application forms.
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { InquiryForm } from '@/components/listings/InquiryForm'
import { ApplicationForm } from '@/components/listings/ApplicationForm'
import { PublicHeader } from '@/components/public/PublicHeader'
import { CARD_PHOTOS } from '@/lib/landing/content'
import { createPublicClient } from '@/lib/supabase/public'
import { getOrgBySlug } from '@/lib/orgs'
import { headers } from 'next/headers'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ org?: string }>
}

function formatCAD(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
}

function resolvePhoto(path: string | undefined, storageBase: string, fallbackIndex: number) {
  if (!path) return CARD_PHOTOS[fallbackIndex % CARD_PHOTOS.length]
  if (path.startsWith('http')) return path
  return `${storageBase}/${path}`
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
    : listing.listing_title

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/org-assets`
  const photoPaths: string[] = property?.photo_paths ?? []
  const heroPhoto = resolvePhoto(photoPaths[0], storageBase, id.charCodeAt(0))
  const galleryPhotos = photoPaths.slice(1, 5).map((p: string) => resolvePhoto(p, storageBase, 0))

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  const mapsQuery = encodeURIComponent(fullAddress)
  const homesHref = orgSlug && orgSlug !== 'canary' ? `/?org=${orgSlug}#homes` : '/#homes'

  const availableLabel = listing.available_from
    ? new Date(listing.available_from).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <>
      <PublicHeader overlay />

      {/* Full-width hero */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 'min(72vh, 680px)',
          marginTop: 0,
          overflow: 'hidden',
          background: 'var(--ink)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroPhoto}
          alt={listing.listing_title}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(16,13,10,.88) 0%, rgba(16,13,10,.35) 45%, rgba(16,13,10,.15) 100%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 1180,
            margin: '0 auto',
            padding: '120px clamp(20px, 4vw, 32px) 48px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            minHeight: 'min(72vh, 680px)',
          }}
        >
          <Link
            href={homesHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 20,
              textDecoration: 'none',
              color: 'rgba(244,239,230,.85)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ← All available homes
          </Link>

          <p
            className="cpub-stat-pill"
            style={{ margin: '0 0 10px', color: 'var(--yellow)' }}
          >
            Available for rent
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 700,
              letterSpacing: '-.02em',
              color: '#f4efe6',
              lineHeight: 1.08,
              maxWidth: 720,
            }}
          >
            {listing.listing_title}
          </h1>
          {fullAddress && (
            <p style={{ margin: '12px 0 0', fontSize: '16px', color: 'rgba(244,239,230,.78)' }}>{fullAddress}</p>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px 28px',
              marginTop: 28,
              paddingTop: 24,
              borderTop: '1px solid rgba(244,239,230,.18)',
            }}
          >
            {unit?.bedrooms != null && (
              <div>
                <div style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace', fontSize: 22, fontWeight: 600, color: '#f4efe6' }}>{unit.bedrooms}</div>
                <div className="cpub-stat-pill">Bedrooms</div>
              </div>
            )}
            {unit?.bathrooms != null && (
              <div>
                <div style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace', fontSize: 22, fontWeight: 600, color: '#f4efe6' }}>{String(unit.bathrooms).replace(/\.0$/, '')}</div>
                <div className="cpub-stat-pill">Bathrooms</div>
              </div>
            )}
            {unit?.sq_footage && (
              <div>
                <div style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace', fontSize: 22, fontWeight: 600, color: '#f4efe6' }}>{unit.sq_footage}</div>
                <div className="cpub-stat-pill">Sq ft</div>
              </div>
            )}
            {availableLabel && (
              <div>
                <div style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace', fontSize: 22, fontWeight: 600, color: '#f4efe6' }}>{availableLabel}</div>
                <div className="cpub-stat-pill">Available</div>
              </div>
            )}
            {rent != null && (
              <div style={{ marginLeft: 'auto' }}>
                <div style={{ fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 700, color: 'var(--yellow)', letterSpacing: '-.02em' }}>
                  {formatCAD(Number(rent))}
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(244,239,230,.7)' }}>/mo</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {galleryPhotos.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            padding: '12px clamp(20px, 4vw, 32px)',
            background: 'var(--panel)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {galleryPhotos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`Photo ${i + 2}`}
              style={{ height: 88, width: 128, flex: 'none', borderRadius: 12, objectFit: 'cover' }}
            />
          ))}
        </div>
      )}

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
                      fontFamily: "var(--font-instrument-serif), 'Instrument Serif', Georgia, serif",
                      fontStyle: 'italic',
                      fontWeight: 400,
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
        </div>
      </main>
    </>
  )
}
