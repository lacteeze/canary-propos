'use client'

import { useEffect, useId, useRef } from 'react'

const WIDGET_SRC = 'https://cdn.hsptb.com/direct-booking-widget/widget-loader.prod.js'

/** Hospitable Direct site templates accepted by `data-theme` / `?theme=`. */
export type HospitableWidgetTheme =
  | 'default'
  | 'city'
  | 'beach'
  | 'boutique'
  | 'luxury'
  | 'clean'
  | 'miami'
  | 'miami-vibe'
  | 'desert'
  | 'desert-winds'
  | 'warm'
  | 'warm-homey'
  | 'camping'
  | (string & {})

export type HospitableDirectBookingWidgetProps = {
  /** Org-level `data-site-uuid` (from HOSPITABLE_SITE_UUID / default Canary site). */
  siteUuid: string
  /** Per-property numeric `data-property-id` from Hospitable Direct → Copy widget code. */
  propertyId: string
  /**
   * Hospitable site template slug passed through to the iframe as `?theme=`.
   * Affects Hospitable brand accents only — not a full dark-mode switch.
   * Widget UI itself is a cross-origin iframe (not CSS-themeable from Canary).
   */
  theme?: HospitableWidgetTheme
}

/**
 * Mounts Hospitable's direct-booking widget loader in a Canary-styled panel.
 * The loader injects a cross-origin iframe (`booking.hospitable.com`); we style
 * the host chrome only so booking IDs and calendar connectivity stay intact.
 */
export function HospitableDirectBookingWidget({
  siteUuid,
  propertyId,
  theme = 'city',
}: HospitableDirectBookingWidgetProps) {
  const scriptMountRef = useRef<HTMLDivElement>(null)
  const reactId = useId().replace(/:/g, '')
  const containerId = `hospitable-booking-${reactId}`
  const site = siteUuid.trim()
  const propId = propertyId.trim()

  useEffect(() => {
    const scriptMount = scriptMountRef.current
    const frame = document.getElementById(containerId)
    if (!scriptMount || !frame || !site || !propId) return

    scriptMount.replaceChildren()
    frame.replaceChildren()

    const script = document.createElement('script')
    script.src = WIDGET_SRC
    script.async = true
    script.dataset.siteUuid = site
    script.dataset.propertyId = propId
    script.dataset.theme = theme
    script.dataset.container = containerId
    script.dataset.reactId = reactId
    scriptMount.appendChild(script)

    return () => {
      scriptMount.replaceChildren()
      frame.replaceChildren()
      // Loader guards on a global `#booking-iframe` id — clear any orphan.
      document.getElementById('booking-iframe')?.remove()
    }
  }, [site, propId, theme, reactId, containerId])

  if (!site || !propId) return null

  return (
    <section className="cpub-booking-widget" aria-label="Book a short-term stay">
      <div className="cpub-booking-widget__intro">
        <h2 className="cpub-booking-widget__title">Book a stay</h2>
        <p className="cpub-booking-widget__sub">
          Check availability and request a booking for short-term stays. Mid- and long-term rentals
          can still inquire below.
        </p>
      </div>

      <div className="cpub-booking-widget__panel">
        <div className="cpub-booking-widget__panel-accent" aria-hidden="true" />
        <div
          id={containerId}
          className="cpub-booking-widget__frame hospitable-direct-booking-mount"
        />
        {/* Script host (loader inserts iframe into #containerId via data-container). */}
        <div ref={scriptMountRef} className="cpub-booking-widget__script-host" hidden />
      </div>
    </section>
  )
}
