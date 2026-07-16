'use client'

import { useState, type CSSProperties, type MouseEvent } from 'react'
import Link from 'next/link'
import type { BrowseListing } from '@/lib/listings/browse-types'
import { fetchListingCardPhotos } from '@/app/actions/listing-card-photos'

export type ListingCardCopy = {
  tBed: string
  tBath: string
  tPark: string
  longTerm: string
  midTerm: string
}

function termBadge(listing: BrowseListing, copy: ListingCardCopy) {
  if (listing.termType === 'mid') return copy.midTerm
  if (listing.termType === 'short') return 'SHORT TERM'
  return copy.longTerm
}

function listingPhotos(listing: BrowseListing): string[] {
  if (listing.photos?.length) return listing.photos
  if (listing.photo) return [listing.photo]
  return []
}

const arrowBtnStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 44,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  padding: '0 10px',
  zIndex: 2,
}

const arrowGlyphStyle: CSSProperties = {
  width: 28,
  height: 28,
  flex: 'none',
  aspectRatio: '1',
  borderRadius: '50%',
  background: 'rgba(24,19,12,.4)',
  border: '1px solid rgba(255,255,255,.5)',
  color: '#fff',
  display: 'grid',
  placeItems: 'center',
  fontSize: 15,
  lineHeight: 1,
  backdropFilter: 'blur(4px)',
  pointerEvents: 'none',
}

export function LandingListingCard({
  listing,
  copy,
  priority = false,
}: {
  listing: BrowseListing
  copy: ListingCardCopy
  /** Eager-load cover for above-the-fold cards. */
  priority?: boolean
}) {
  const initialPhotos = listingPhotos(listing)
  const [photos, setPhotos] = useState(initialPhotos)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [galleryLoaded, setGalleryLoaded] = useState(
    (listing.photoCount ?? initialPhotos.length) <= initialPhotos.length
  )
  const [loadingGallery, setLoadingGallery] = useState(false)

  const knownCount = galleryLoaded ? photos.length : (listing.photoCount ?? photos.length)
  const canCycle = knownCount > 1
  const activePhoto = photos[photoIndex] ?? photos[0] ?? null

  async function cyclePhoto(delta: number, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!canCycle || loadingGallery) return

    let list = photos
    if (!galleryLoaded || list.length < 2) {
      setLoadingGallery(true)
      try {
        const full = await fetchListingCardPhotos(listing.id)
        if (full.length > 0) {
          list = full
          setPhotos(full)
        }
        setGalleryLoaded(true)
      } finally {
        setLoadingGallery(false)
      }
      if (list.length < 2) return
    }

    setPhotoIndex((i) => (i + delta + list.length) % list.length)
  }

  return (
    <Link
      href={listing.href}
      className="cl2-card"
      style={{
        textDecoration: 'none',
        color: 'inherit',
        background: 'var(--elev)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <div
        style={{
          height: 190,
          position: 'relative',
          backgroundColor: 'var(--hover)',
          ...(!activePhoto
            ? {
                background:
                  'linear-gradient(145deg, var(--hover) 0%, var(--panel) 55%, var(--elev) 100%)',
              }
            : {}),
        }}
      >
        {activePhoto ? (
          // Signed storage URLs — skip next/image optimizer fanout on browse cards
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activePhoto}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '0 20px',
              textAlign: 'center',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.02em',
                color: 'var(--dim)',
              }}
            >
              Photos coming soon
            </span>
          </div>
        )}
        {loadingGallery ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(24,19,12,.28)',
              zIndex: 3,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: '#f4efe6',
                background: 'rgba(24,19,12,.55)',
                border: '1px solid rgba(255,255,255,.35)',
                borderRadius: 999,
                padding: '6px 12px',
                backdropFilter: 'blur(4px)',
              }}
            >
              Loading…
            </span>
          </div>
        ) : null}
        <span
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            background: 'rgba(24,19,12,.6)',
            color: '#f4efe6',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.05em',
            padding: '5px 11px',
            borderRadius: 999,
            backdropFilter: 'blur(4px)',
            zIndex: 1,
          }}
        >
          {termBadge(listing, copy)}
        </span>
        {canCycle ? (
          <>
            <button
              type="button"
              className="cl2-swipe"
              aria-label="Previous photo"
              disabled={loadingGallery}
              onClick={(e) => void cyclePhoto(-1, e)}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              style={{
                ...arrowBtnStyle,
                left: 0,
                justifyContent: 'flex-start',
                opacity: loadingGallery ? 0.55 : 1,
              }}
            >
              <span style={arrowGlyphStyle}>←</span>
            </button>
            <button
              type="button"
              className="cl2-swipe"
              aria-label="Next photo"
              disabled={loadingGallery}
              onClick={(e) => void cyclePhoto(1, e)}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              style={{
                ...arrowBtnStyle,
                right: 0,
                justifyContent: 'flex-end',
                opacity: loadingGallery ? 0.55 : 1,
              }}
            >
              <span style={arrowGlyphStyle}>→</span>
            </button>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 10,
                display: 'flex',
                justifyContent: 'center',
                gap: 5,
                zIndex: 1,
                pointerEvents: 'none',
              }}
            >
              {Array.from({ length: knownCount }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: i === photoIndex ? '#fff' : 'rgba(255,255,255,.45)',
                    boxShadow: '0 0 2px rgba(0,0,0,.35)',
                  }}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div style={{ padding: '15px 17px 17px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 16,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {listing.shortAddress}
          </span>
          <span style={{ flex: 'none', fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>
            {listing.rentFormatted}
            {listing.rentN ? (
              <span style={{ color: 'var(--faint)', fontWeight: 500, fontSize: 12 }}>/mo</span>
            ) : null}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--dim)' }}>
          <span>
            <b style={{ color: 'var(--text)' }}>{listing.beds}</b> {copy.tBed}
          </span>
          <span>
            <b style={{ color: 'var(--text)' }}>{listing.bathsLabel}</b> {copy.tBath}
          </span>
          <span>
            <b style={{ color: 'var(--text)' }}>{listing.parking}</b> {copy.tPark}
          </span>
        </div>
      </div>
    </Link>
  )
}
