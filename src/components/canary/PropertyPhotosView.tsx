'use client'

import { useEffect, useMemo, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { signPropertyCoverPaths } from '@/app/actions/property-cover-photos'
import type { CanaryProperty } from '@/lib/canary/types'

function short(addr: string | null | undefined): string {
  return (addr || '').split(',')[0].trim()
}

function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return ''
  return '$' + Math.round(n).toLocaleString('en-CA')
}

function statusChip(st: string): [string, string] {
  if (st === 'Leased') return ['var(--green)', 'var(--green-text)']
  if (st === 'Vacant') return ['var(--amber)', 'var(--amber-text)']
  if (st === 'STR' || st === 'Airbnb') return ['var(--blue)', 'var(--bg)']
  return ['var(--elev)', 'var(--dim)']
}

type PropertyPhotosViewProps = {
  properties: CanaryProperty[]
  onOpen: (id: string) => void
}

export default function PropertyPhotosView({ properties, onOpen }: PropertyPhotosViewProps) {
  const coverPaths = useMemo(
    () => properties.map((p) => p.listingPhotoPaths?.[0] ?? ''),
    [properties]
  )
  const pathKey = coverPaths.join('\0')

  const [coverUrls, setCoverUrls] = useState<string[]>(() => coverPaths.map(() => ''))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)

    if (!coverPaths.some(Boolean)) {
      setCoverUrls(coverPaths.map(() => ''))
      setReady(true)
      return
    }

    void signPropertyCoverPaths(coverPaths).then((signed) => {
      if (cancelled) return
      setCoverUrls(signed)
      setReady(true)
    })

    return () => {
      cancelled = true
    }
    // pathKey tracks coverPaths contents without depending on array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey])

  if (!properties.length) {
    return <div style={{ padding: 24, color: 'var(--dim)' }}>No properties match.</div>
  }

  return (
    <div className="cy-photo-grid" role="list">
      {properties.map((p, i) => {
        const cover = ready ? coverUrls[i] || '' : ''
        const hasPath = Boolean(coverPaths[i])
        const [chipBg, chipColor] = statusChip(p.status)
        const cityLine =
          [p.city, p.area].filter(Boolean).join(' · ') ||
          p.address.split(',').slice(1, 2).join('').trim()

        return (
          <button
            key={p.id}
            type="button"
            role="listitem"
            className="cy-photo-card cy-hov-card"
            onClick={() => onOpen(p.id)}
          >
            <div className="cy-photo-card-media">
              {cover ? (
                // Signed storage URLs — skip next/image optimizer fanout on portfolio grid
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              ) : (
                <div className="cy-photo-card-placeholder" aria-hidden="true">
                  {hasPath && !ready ? (
                    <span className="cy-photo-card-placeholder-label">Loading…</span>
                  ) : (
                    <>
                      <ImageOff size={22} strokeWidth={1.75} />
                      <span className="cy-photo-card-placeholder-label">No listing photos</span>
                    </>
                  )}
                </div>
              )}
              <span
                className="cy-photo-card-status"
                style={{ background: chipBg, color: chipColor }}
              >
                {p.status || '—'}
              </span>
            </div>
            <div className="cy-photo-card-body">
              <div className="cy-photo-card-title">{short(p.address)}</div>
              {cityLine ? <div className="cy-photo-card-sub">{cityLine}</div> : null}
              <div className="cy-photo-card-meta">
                <span>
                  <b>{p.beds || '—'}</b> bed
                </span>
                <span>
                  <b>{p.baths || '—'}</b> bath
                </span>
                {p.rate ? (
                  <span className="cy-photo-card-rate">{money(p.rate)}/mo</span>
                ) : null}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
