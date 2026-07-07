'use client'

import { useRef } from 'react'
import { displayAccentStyle } from '@/lib/landing/typography'
import { LandingListingCard, type ListingCardCopy } from '@/components/landing/LandingListingCard'
import type { CityGroup } from '@/lib/listings/browse-types'

interface SimilarListingsSectionProps {
  groups: CityGroup[]
  copy: ListingCardCopy
}

function CarouselRow({
  listings,
  city,
  copy,
  isFirstSection,
}: {
  listings: CityGroup['listings']
  city: string
  copy: ListingCardCopy
  isFirstSection: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    const cardWidth = el.querySelector('.cl2-card')?.clientWidth ?? 280
    el.scrollBy({ left: direction * (cardWidth + 18), behavior: 'smooth' })
  }

  return (
    <section
      aria-label={`More homes in ${city}`}
      style={{
        marginTop: isFirstSection ? 48 : 40,
        paddingTop: isFirstSection ? 40 : 0,
        borderTop: isFirstSection ? '1px solid var(--border)' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          {isFirstSection ? (
            <div
              style={{
                fontFamily: 'var(--font-ibm-plex-mono), monospace',
                fontSize: '11.5px',
                letterSpacing: '.14em',
                color: 'var(--faint)',
                marginBottom: 8,
              }}
            >
              EXPLORE MORE
            </div>
          ) : null}
          <h2
            style={{
              margin: 0,
              fontSize: 'clamp(22px, 3vw, 28px)',
              fontWeight: 700,
              letterSpacing: '-.02em',
            }}
          >
            More homes in{' '}
            <em style={displayAccentStyle}>{city}</em>
          </h2>
        </div>
        {listings.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
            <button
              type="button"
              aria-label={`Scroll ${city} listings left`}
              onClick={() => scroll(-1)}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '1px solid var(--border2)',
                background: 'var(--elev)',
                cursor: 'pointer',
                fontSize: 18,
                color: 'var(--dim)',
              }}
            >
              ←
            </button>
            <button
              type="button"
              aria-label={`Scroll ${city} listings right`}
              onClick={() => scroll(1)}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '1px solid var(--border2)',
                background: 'var(--elev)',
                cursor: 'pointer',
                fontSize: 18,
                color: 'var(--dim)',
              }}
            >
              →
            </button>
          </div>
        )}
      </div>

      <div ref={trackRef} className="cpub-similar-track">
        {listings.map((listing) => (
          <LandingListingCard key={listing.id} listing={listing} copy={copy} />
        ))}
      </div>
    </section>
  )
}

export function SimilarListingsSection({ groups, copy }: SimilarListingsSectionProps) {
  if (!groups.length) return null

  return (
    <>
      {groups.map((group, index) => (
        <CarouselRow
          key={group.city}
          listings={group.listings}
          city={group.city}
          copy={copy}
          isFirstSection={index === 0}
        />
      ))}
    </>
  )
}

/** @deprecated Use SimilarListingsSection with a single group instead. */
export function SimilarListingsCarousel({
  listings,
  city,
  copy,
}: {
  listings: CityGroup['listings']
  city: string
  copy: ListingCardCopy
}) {
  if (!listings.length) return null
  return <CarouselRow listings={listings} city={city} copy={copy} isFirstSection />
}
