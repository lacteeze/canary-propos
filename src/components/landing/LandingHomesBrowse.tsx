'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { ListingsFilterBar } from '@/components/listings/ListingsFilterBar'
import { LandingListingCard, type ListingCardCopy } from '@/components/landing/LandingListingCard'
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
  copy: ListingCardCopy
}

const DEFAULT_FILTERS: BrowseFilters = {
  q: '',
  term: 'all',
  beds: '',
  price: '',
  pets: false,
  sort: 'new',
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
        <a href="#contact" style={{ color: 'var(--accent)', fontWeight: 600 }}>
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
                {group.listings.map((listing, index) => (
                  <LandingListingCard
                    key={listing.id}
                    listing={listing}
                    copy={copy}
                    priority={group === groups[0] && index < 4}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
