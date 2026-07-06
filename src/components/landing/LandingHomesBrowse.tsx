'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { ListingsFilterBar } from '@/components/listings/ListingsFilterBar'
import '@/components/listings/listings-browse.css'
import type { BrowseFilters, BrowseListing } from '@/lib/listings/browse-types'
import {
  countLabel,
  filterListings,
  groupListingsByCity,
  sortListings,
} from '@/lib/listings/browse-utils'

interface LandingHomesBrowseProps {
  listings: BrowseListing[]
  staysHref: string
  copy: {
    tBed: string
    tBath: string
    longTerm: string
    midTerm: string
  }
}

const DEFAULT_FILTERS: BrowseFilters = {
  q: '',
  term: 'all',
  beds: '',
  price: '',
  pets: false,
  sort: 'new',
}

function termBadge(listing: BrowseListing, copy: LandingHomesBrowseProps['copy']) {
  if (listing.termType === 'mid') return copy.midTerm
  if (listing.termType === 'short') return 'SHORT TERM'
  return copy.longTerm
}

function LandingListingCard({
  listing,
  copy,
}: {
  listing: BrowseListing
  copy: LandingHomesBrowseProps['copy']
}) {
  const extra =
    listing.tags.find((tag) => tag.includes('🐾'))?.replace('🐾 ', '') ??
    listing.city

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
              <span style={{ color: 'var(--faint)', fontWeight: 500, fontSize: 12 }}>
                /mo {listing.rentSuffix}
              </span>
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
          <span>{extra}</span>
        </div>
      </div>
    </Link>
  )
}

export function LandingHomesBrowse({ listings, staysHref, copy }: LandingHomesBrowseProps) {
  const [filters, setFilters] = useState<BrowseFilters>(DEFAULT_FILTERS)

  const patchFilters = useCallback((patch: Partial<BrowseFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
  }, [])

  const filtered = useMemo(
    () => sortListings(filterListings(listings, filters), filters.sort),
    [listings, filters]
  )
  const groups = useMemo(
    () => groupListingsByCity(filtered, { mergeOuterBay: true }),
    [filtered]
  )

  const isEmpty = filtered.length === 0
  const shortTermEmpty = filters.term === 'short' && isEmpty && listings.length > 0

  if (listings.length === 0) {
    return (
      <div
        style={{
          background: 'var(--elev)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 22,
          color: 'var(--dim)',
        }}
      >
        Nothing available right this minute — new homes are posted here the moment they&apos;re
        ready.{' '}
        <a href="mailto:info@canarypm.ca" style={{ color: 'var(--accent)', fontWeight: 600 }}>
          Join the waitlist
        </a>
        .
      </div>
    )
  }

  return (
    <div className="cl2-homes-browse">
      <ListingsFilterBar
        filters={filters}
        onFiltersChange={patchFilters}
        countLabel={countLabel(filtered.length, listings.length)}
        showTitle={false}
        className="cl2-homes-browse cnry-browse"
      />

      {isEmpty ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--dim)' }}>
          <div style={{ marginBottom: 6, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            No homes match those filters
          </div>
          <p style={{ margin: 0, maxWidth: 420, marginInline: 'auto', fontSize: 14 }}>
            {shortTermEmpty ? (
              <>
                Short-term stays are listed separately.{' '}
                <Link href={staysHref} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  Browse short stays below
                </Link>
                .
              </>
            ) : (
              'Try widening your price range or clearing a filter.'
            )}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {groups.map((group) => (
            <section key={group.city}>
              <h3
                style={{
                  margin: '0 0 16px',
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--border)',
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '-.02em',
                }}
              >
                {group.city}
                <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 600, color: 'var(--dim)' }}>
                  {group.listings.length} {group.listings.length === 1 ? 'home' : 'homes'}
                </span>
              </h3>
              <div className="cl2-card-grid">
                {group.listings.map((listing) => (
                  <LandingListingCard key={listing.id} listing={listing} copy={copy} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
