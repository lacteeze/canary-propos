'use client'

import { useEffect, useId, useRef } from 'react'

const WIDGET_SRC = 'https://cdn.hsptb.com/direct-booking-widget/widget-loader.prod.js'

export type HospitableDirectBookingWidgetProps = {
  /** Org-level `data-site-uuid` (from HOSPITABLE_SITE_UUID / default Canary site). */
  siteUuid: string
  /** Per-property numeric `data-property-id` from Hospitable Direct → Copy widget code. */
  propertyId: string
  theme?: string
}

/**
 * Mounts Hospitable's direct-booking widget loader in a dedicated container.
 * Uses a client effect (not next/script alone) so data-* attrs remount cleanly
 * per property and cleanup on navigation.
 */
export function HospitableDirectBookingWidget({
  siteUuid,
  propertyId,
  theme = 'city',
}: HospitableDirectBookingWidgetProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const reactId = useId()
  const site = siteUuid.trim()
  const propId = propertyId.trim()

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !site || !propId) return

    mount.replaceChildren()

    const script = document.createElement('script')
    script.src = WIDGET_SRC
    script.async = true
    script.dataset.siteUuid = site
    script.dataset.propertyId = propId
    script.dataset.theme = theme
    script.dataset.reactId = reactId
    mount.appendChild(script)

    return () => {
      mount.replaceChildren()
    }
  }, [site, propId, theme, reactId])

  if (!site || !propId) return null

  return (
    <section aria-label="Book a short-term stay" style={{ marginBottom: 8 }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Book a stay</h2>
      <p style={{ margin: '0 0 16px', color: 'var(--dim)', fontSize: 14.5, lineHeight: 1.5 }}>
        Check availability and request a booking for short-term stays. Mid- and long-term rentals
        can still inquire below.
      </p>
      <div ref={mountRef} className="hospitable-direct-booking-mount" />
    </section>
  )
}
