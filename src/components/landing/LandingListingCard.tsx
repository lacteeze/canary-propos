'use client'

import Link from 'next/link'
import type { BrowseListing } from '@/lib/listings/browse-types'

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

export function LandingListingCard({
  listing,
  copy,
}: {
  listing: BrowseListing
  copy: ListingCardCopy
}) {
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
          backgroundImage: listing.photo ? `url('${listing.photo}')` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          backgroundColor: 'var(--hover)',
        }}
      >
        {!listing.photo ? (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              height: '100%',
              fontSize: 40,
              color: 'var(--faint)',
            }}
          >
            🏠
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
          }}
        >
          {termBadge(listing, copy)}
        </span>
        {listing.photo ? (
          <button
            type="button"
            className="cl2-swipe"
            aria-hidden="true"
            tabIndex={-1}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 44,
              border: 'none',
              background: 'none',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '0 10px',
            }}
          >
            <span
              style={{
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
              }}
            >
              →
            </span>
          </button>
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
