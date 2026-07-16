'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

type ListingPhotoGalleryProps = {
  photos: string[]
  title: string
  children: ReactNode
  /** Anchored to the top of the hero (e.g. back link) */
  topBar?: ReactNode
}

export function ListingPhotoGallery({ photos, title, children, topBar }: ListingPhotoGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const open = openIndex !== null
  const active = openIndex !== null ? photos[openIndex] ?? null : null
  const stripPhotos = photos.slice(1)

  useEffect(() => {
    setMounted(true)
  }, [])

  const close = useCallback(() => {
    setOpenIndex(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const openAt = useCallback((index: number) => {
    if (!photos.length) return
    const safe = Math.max(0, Math.min(index, photos.length - 1))
    setOpenIndex(safe)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [photos.length])

  const go = useCallback(
    (delta: number) => {
      if (openIndex === null || photos.length < 2) return
      const next = (openIndex + delta + photos.length) % photos.length
      setOpenIndex(next)
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    },
    [openIndex, photos.length]
  )

  const bumpZoom = useCallback((delta: number) => {
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((z + delta) * 10) / 10))
      if (next === MIN_ZOOM) setOffset({ x: 0, y: 0 })
      return next
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === '+' || e.key === '=') bumpZoom(ZOOM_STEP)
      if (e.key === '-' || e.key === '_') bumpZoom(-ZOOM_STEP)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close, go, bumpZoom])

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom <= MIN_ZOOM) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    setOffset({
      x: d.ox + (e.clientX - d.x),
      y: d.oy + (e.clientY - d.y),
    })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId)
      dragRef.current = null
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    if (!open) return
    e.preventDefault()
    bumpZoom(e.deltaY < 0 ? ZOOM_STEP / 2 : -ZOOM_STEP / 2)
  }

  const stripRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateStripScroll = useCallback(() => {
    const el = stripRef.current
    if (!el) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateStripScroll()
    const el = stripRef.current
    if (!el) return
    const onScroll = () => updateStripScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onScroll) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ro?.disconnect()
    }
  }, [updateStripScroll, stripPhotos.length])

  const scrollStrip = useCallback((dir: -1 | 1) => {
    const el = stripRef.current
    if (!el) return
    // Jump ~one viewport (or 2 large thumbs) instantly — smooth felt too slow
    const step = Math.max(720, Math.round(el.clientWidth * 0.92))
    el.scrollBy({ left: dir * step, behavior: 'auto' })
  }, [])

  const lightbox =
    open && active ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title} photo viewer`}
        onClick={close}
        onWheel={onWheel}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(10, 8, 6, 0.92)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            zIndex: 2,
          }}
        >
          <span
            style={{
              color: 'rgba(244,239,230,.85)',
              fontSize: 13,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {(openIndex ?? 0) + 1} / {photos.length}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ToolbarButton label="Zoom out" onClick={(e) => { e.stopPropagation(); bumpZoom(-ZOOM_STEP) }}>
              −
            </ToolbarButton>
            <span
              style={{
                minWidth: 48,
                textAlign: 'center',
                color: 'rgba(244,239,230,.85)',
                fontSize: 13,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <ToolbarButton label="Zoom in" onClick={(e) => { e.stopPropagation(); bumpZoom(ZOOM_STEP) }}>
              +
            </ToolbarButton>
            <ToolbarButton label="Reset zoom" onClick={(e) => { e.stopPropagation(); setZoom(1); setOffset({ x: 0, y: 0 }) }}>
              1×
            </ToolbarButton>
            <ToolbarButton label="Close photo viewer" onClick={(e) => { e.stopPropagation(); close() }}>
              ✕
            </ToolbarButton>
          </div>
        </div>

        {photos.length > 1 && (
          <>
            <ToolbarButton
              label="Previous photo"
              onClick={(e) => { e.stopPropagation(); go(-1) }}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: 44, height: 44 }}
            >
              ‹
            </ToolbarButton>
            <ToolbarButton
              label="Next photo"
              onClick={(e) => { e.stopPropagation(); go(1) }}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: 44, height: 44 }}
            >
              ›
            </ToolbarButton>
          </>
        )}

        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            maxWidth: 'min(1100px, 100%)',
            maxHeight: 'min(85vh, 900px)',
            width: '100%',
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            cursor: zoom > MIN_ZOOM ? 'grab' : 'zoom-in',
            touchAction: 'none',
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            if (zoom > MIN_ZOOM) {
              setZoom(1)
              setOffset({ x: 0, y: 0 })
            } else {
              bumpZoom(1)
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active}
            alt={`${title} — photo ${(openIndex ?? 0) + 1}`}
            draggable={false}
            style={{
              maxWidth: '100%',
              maxHeight: 'min(85vh, 900px)',
              objectFit: 'contain',
              borderRadius: 12,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transition: dragRef.current ? 'none' : 'transform 120ms ease-out',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>

        <p
          style={{
            position: 'absolute',
            bottom: 16,
            margin: 0,
            color: 'rgba(244,239,230,.55)',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          Scroll or +/- to zoom · drag to pan · Esc to close
        </p>
      </div>
    ) : null

  const hasPhotos = photos.length > 0

  return (
    <>
      <section
        role={hasPhotos ? 'button' : undefined}
        tabIndex={hasPhotos ? 0 : undefined}
        aria-label={hasPhotos ? `View larger photo of ${title}` : undefined}
        onClick={hasPhotos ? () => openAt(0) : undefined}
        onKeyDown={
          hasPhotos
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openAt(0)
                }
              }
            : undefined
        }
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 'min(56vh, 520px)',
          marginTop: 0,
          overflow: 'hidden',
          background: hasPhotos
            ? 'var(--ink)'
            : 'linear-gradient(160deg, #1a1612 0%, #2a241c 42%, #1c1814 100%)',
          cursor: hasPhotos ? 'zoom-in' : 'default',
        }}
      >
        {hasPhotos ? (
          // Hero is the LCP element — load it eagerly at high priority so it
          // wins bandwidth over the (lazy) thumbnail strip below.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photos[0]}
            alt={title}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              pointerEvents: 'none',
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              pointerEvents: 'none',
              paddingBottom: '18%',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(244,239,230,.45)',
              }}
            >
              Gallery
            </span>
            <span
              style={{
                fontSize: 'clamp(20px, 3vw, 28px)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'rgba(244,239,230,.78)',
              }}
            >
              Photos coming soon
            </span>
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(16,13,10,.88) 0%, rgba(16,13,10,.35) 45%, rgba(16,13,10,.15) 100%)',
            pointerEvents: 'none',
          }}
        />
        {topBar ? (
          <div
            className="cpub-listing-hero-topbar"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 2,
              maxWidth: 1180,
              margin: '0 auto',
              pointerEvents: 'none',
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement
              if (target.closest('a, button')) e.stopPropagation()
            }}
          >
            <div style={{ pointerEvents: 'auto', display: 'inline-flex' }}>{topBar}</div>
          </div>
        ) : null}
        <div
          className="cpub-listing-hero-overlay"
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 1180,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
          onClick={(e) => {
            const target = e.target as HTMLElement
            // Keep nav / real controls working; everything else opens the viewer
            if (target.closest('a, button, input, textarea, select, label')) {
              e.stopPropagation()
            }
          }}
        >
          {children}
        </div>
      </section>

      {stripPhotos.length > 0 && (
        <div
          style={{
            position: 'relative',
            background: 'var(--panel)',
            borderBottom: '1px solid var(--border)',
            padding: '14px 0',
          }}
        >
          {canScrollLeft && (
            <button
              type="button"
              aria-label="Scroll photos left"
              onClick={() => scrollStrip(-1)}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 2,
                width: 44,
                height: 44,
                borderRadius: 999,
                border: '1px solid var(--border2)',
                background: 'var(--elev)',
                color: 'var(--text)',
                boxShadow: 'var(--shadow)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: 24,
                lineHeight: 1,
                fontWeight: 700,
              }}
            >
              ‹
            </button>
          )}
          {canScrollRight && (
            <button
              type="button"
              aria-label="Scroll photos right"
              onClick={() => scrollStrip(1)}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 2,
                width: 44,
                height: 44,
                borderRadius: 999,
                border: '1px solid var(--border2)',
                background: 'var(--elev)',
                color: 'var(--text)',
                boxShadow: 'var(--shadow)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: 24,
                lineHeight: 1,
                fontWeight: 700,
              }}
            >
              ›
            </button>
          )}
          <div
            ref={stripRef}
            className="cpub-photo-strip"
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              paddingLeft: canScrollLeft ? 58 : 0,
              paddingRight: canScrollRight ? 58 : 0,
            }}
          >
            {stripPhotos.map((src, i) => {
              const photoIndex = i + 1
              return (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => openAt(photoIndex)}
                  aria-label={`Open photo ${photoIndex + 1} of ${photos.length}`}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'zoom-in',
                    flex: 'none',
                    borderRadius: 14,
                    overflow: 'hidden',
                  }}
                >
                  {/* Defer thumbnail bytes so the hero paints first; the strip
                      is horizontally scrollable so off-screen thumbs stay idle. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Photo ${photoIndex + 1}`}
                    loading="lazy"
                    decoding="async"
                    style={{
                      display: 'block',
                      height: 'clamp(160px, 26vw, 224px)',
                      width: 'clamp(224px, 37vw, 320px)',
                      objectFit: 'cover',
                    }}
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {mounted && lightbox ? createPortal(lightbox, document.body) : null}
    </>
  )
}

function ToolbarButton({
  label,
  onClick,
  children,
  style,
}: {
  label: string
  onClick: (e: React.MouseEvent) => void
  children: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,.28)',
        background: 'rgba(24,19,12,.55)',
        color: '#f4efe6',
        fontSize: 18,
        fontWeight: 700,
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        lineHeight: 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}
