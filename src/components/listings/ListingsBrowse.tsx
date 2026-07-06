'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { ListingsFilterBar } from '@/components/listings/ListingsFilterBar'
import type { BrowseFilters, BrowseListing, CityGroup } from '@/lib/listings/browse-types'
import './listings-browse.css'

interface ListingsBrowseProps {
  orgSlug: string
  filters: BrowseFilters
  groups: CityGroup[]
  filteredCount: number
  totalCount: number
  countLabel: string
  staysHref: string
}

function ListingCard({ listing }: { listing: BrowseListing }) {
  return (
    <Link
      href={listing.href}
      className="cnry-browse-card group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--elev)]"
    >
      <div className="relative h-[180px] bg-[var(--hover)]">
        {listing.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.photo}
            alt={listing.shortAddress}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-[var(--faint)]">
            🏠
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold tracking-wide text-[var(--ink)] backdrop-blur-sm">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: listing.termDot }}
          />
          {listing.termLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0 text-base font-bold leading-snug">{listing.shortAddress}</div>
          <div className="shrink-0 text-base font-bold">
            {listing.rentFormatted}
            {listing.rentN ? (
              <span className="text-xs font-medium text-[var(--faint)]">
                /mo {listing.rentSuffix}
              </span>
            ) : null}
          </div>
        </div>

        <div className="text-[13px] text-[var(--dim)]">
          {listing.city}
          {listing.province ? ` · ${listing.province}` : ''}
        </div>

        <div className="flex flex-wrap gap-3.5 text-[13.5px] text-[var(--dim)]">
          <span>
            <b className="text-[var(--text)]">{listing.beds}</b> bed
          </span>
          <span>
            <b className="text-[var(--text)]">{listing.bathsLabel}</b> bath
          </span>
          <span>
            <b className="text-[var(--text)]">{listing.parking}</b> parking
          </span>
        </div>

        <div className="text-xs text-[var(--dim)]">Move-in {listing.moveIn}</div>

        {listing.tags.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-0.5">
            {listing.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border)] bg-[var(--hover)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--dim)]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  )
}

export function ListingsBrowse({
  orgSlug,
  filters,
  groups,
  filteredCount,
  totalCount,
  countLabel,
  staysHref,
}: ListingsBrowseProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const pushFilters = useCallback(
    (patch: Partial<BrowseFilters>) => {
      const params = new URLSearchParams(searchParams.toString())
      if (orgSlug) params.set('org', orgSlug)

      const next = { ...filters, ...patch }

      if (next.q) params.set('q', next.q)
      else params.delete('q')

      if (next.term && next.term !== 'all') params.set('term', next.term)
      else params.delete('term')

      if (next.beds) params.set('beds', next.beds)
      else params.delete('beds')

      if (next.price) params.set('price', next.price)
      else params.delete('price')

      if (next.pets) params.set('pets', '1')
      else params.delete('pets')

      if (next.sort && next.sort !== 'new') params.set('sort', next.sort)
      else params.delete('sort')

      startTransition(() => {
        router.replace(`/listings?${params.toString()}`, { scroll: false })
      })
    },
    [filters, orgSlug, router, searchParams]
  )

  const isEmpty = filteredCount === 0
  const shortTermEmpty = filters.term === 'short' && isEmpty && totalCount > 0

  return (
    <div className={`cnry-browse ${isPending ? 'opacity-80' : ''}`}>
      <ListingsFilterBar
        filters={filters}
        onFiltersChange={pushFilters}
        countLabel={countLabel}
      />

      {isEmpty ? (
        <div className="py-16 text-center text-[var(--dim)]">
          <div className="mb-1.5 text-[17px] font-bold text-[var(--text)]">
            {totalCount ? 'No homes match those filters' : 'Nothing available right now'}
          </div>
          <p className="mx-auto max-w-md text-sm">
            {shortTermEmpty ? (
              <>
                Short-term stays are listed separately.{' '}
                <Link href={staysHref} className="font-semibold text-[var(--accent)] underline">
                  Browse short stays on our homepage
                </Link>
                .
              </>
            ) : totalCount ? (
              'Try widening your price range or clearing a filter.'
            ) : (
              'New listings are posted here as soon as they are ready.'
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.city}>
              <h2 className="mb-4 border-b border-[var(--border)] pb-2 text-lg font-bold tracking-tight">
                {group.city}
                <span className="ml-2 text-sm font-medium text-[var(--dim)]">
                  {group.listings.length} {group.listings.length === 1 ? 'home' : 'homes'}
                </span>
              </h2>
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                {group.listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
