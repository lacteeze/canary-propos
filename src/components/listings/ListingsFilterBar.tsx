'use client'

import type { BrowseFilters } from '@/lib/listings/browse-types'
import { TERM_TABS } from '@/lib/listings/browse-utils'

interface ListingsFilterBarProps {
  filters: BrowseFilters
  onFiltersChange: (patch: Partial<BrowseFilters>) => void
  countLabel: string
  showTitle?: boolean
  className?: string
}

export function ListingsFilterBar({
  filters,
  onFiltersChange,
  countLabel,
  showTitle = true,
  className = 'cnry-browse',
}: ListingsFilterBarProps) {
  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3.5">
        {showTitle ? (
          <div>
            <h1 className="m-0 text-[26px] font-bold tracking-tight">Available now</h1>
            <p className="mt-1 text-[13.5px] text-[var(--dim)]">{countLabel}</p>
          </div>
        ) : (
          <p className="m-0 text-[13.5px] text-[var(--dim)]">{countLabel}</p>
        )}

        <div className="flex gap-0.5 rounded-full border border-[var(--border)] bg-[var(--elev)] p-1">
          {TERM_TABS.map((tab) => {
            const active = filters.term === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onFiltersChange({ term: tab.key })}
                className="cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
                style={{
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--ink-text)' : 'var(--dim)',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-[14px] border border-[var(--border)] bg-[var(--elev)] p-2.5 shadow-[0_2px_10px_rgba(70,55,35,0.06)]">
        <input
          type="search"
          value={filters.q}
          onChange={(e) => onFiltersChange({ q: e.target.value })}
          placeholder="Search by street or area…"
          className="min-w-[150px] flex-[2_1_180px] rounded-[9px] border border-[var(--border)] bg-[var(--panel)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--border2)]"
        />

        <select
          value={filters.beds}
          onChange={(e) => onFiltersChange({ beds: e.target.value })}
          className="cursor-pointer rounded-[9px] border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2"
        >
          <option value="">Any beds</option>
          <option value="1">1+ bed</option>
          <option value="2">2+ beds</option>
          <option value="3">3+ beds</option>
          <option value="4">4+ beds</option>
        </select>

        <select
          value={filters.price}
          onChange={(e) => onFiltersChange({ price: e.target.value })}
          className="cursor-pointer rounded-[9px] border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2"
        >
          <option value="">Any price</option>
          <option value="1000">Under $1,000</option>
          <option value="1500">Under $1,500</option>
          <option value="2000">Under $2,000</option>
          <option value="2500">Under $2,500</option>
        </select>

        <button
          type="button"
          onClick={() => onFiltersChange({ pets: !filters.pets })}
          className="cursor-pointer rounded-[9px] border px-3 py-2 text-[13px] font-semibold transition-colors"
          style={{
            borderColor: filters.pets ? 'var(--accent)' : 'var(--border)',
            background: filters.pets ? 'var(--accent)' : 'var(--panel)',
            color: filters.pets ? 'var(--accent-text)' : 'var(--dim)',
          }}
        >
          🐾 Pet friendly
        </button>

        <select
          value={filters.sort}
          onChange={(e) => onFiltersChange({ sort: e.target.value as BrowseFilters['sort'] })}
          className="ml-auto cursor-pointer rounded-[9px] border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[13.5px] text-[var(--dim)]"
        >
          <option value="new">Newest first</option>
          <option value="lo">Price: low → high</option>
          <option value="hi">Price: high → low</option>
          <option value="soon">Available soonest</option>
        </select>
      </div>
    </div>
  )
}
