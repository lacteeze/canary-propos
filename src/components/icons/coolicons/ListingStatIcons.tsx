import type { ReactNode } from 'react'

type StatIconProps = {
  size?: number
}

function Coolicon({ size = 15, children }: StatIconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ display: 'block', flex: 'none' }}
    >
      {children}
    </svg>
  )
}

/**
 * Icons8 bed glyph reconstructed from the user's icons8-bed-48 PNG pixels
 * (black silhouette on transparent; 48×48, opaque bbox 4–43 × 7–40).
 * Official Icons8 SVG is paid, so this is a geometric trace: rounded headboard
 * ring, two pillow capsules, open-bottom bed frame, mattress slat.
 * Coords are in 48-space, scaled into Coolicon's 24 viewBox.
 */
export function BedStatIcon({ size }: StatIconProps) {
  return (
    <Coolicon size={size}>
      <g fill="currentColor" transform="scale(0.5)">
        <path
          fillRule="evenodd"
          d="M11 7h26a3 3 0 0 1 3 3v10H8V10A3 3 0 0 1 11 7Zm0 3h26v9H11V10Z"
        />
        <rect x="14" y="17" width="8" height="2" rx="1" />
        <rect x="26" y="17" width="8" height="2" rx="1" />
        <path d="M4 41V22a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v19h-3V22H7v19H4Z" />
        <rect x="4" y="32" width="40" height="3" />
      </g>
    </Coolicon>
  )
}

/**
 * Icons8 bathtub glyph reconstructed from the user's icons8-bathtub-48 PNG
 * (black silhouette on transparent; 48×48, opaque bbox 2–45 × 4–42).
 * Official Icons8 SVG is paid, so this is a geometric trace: showerhead
 * horseshoe, right-side nozzle, pipe, rim, tapered bowl, feet.
 * Coords are in 48-space, scaled into Coolicon's 24 viewBox.
 */
export function BathStatIcon({ size }: StatIconProps) {
  return (
    <Coolicon size={size}>
      <g transform="scale(0.5)">
        <path
          d="M8.3 15.4A6.1 6.1 0 1 1 18.9 14.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="butt"
        />
        <rect x="15" y="11" width="8" height="3.6" rx="1.8" fill="currentColor" />
        <rect x="7" y="7" width="3" height="14" fill="currentColor" />
        <rect x="2" y="21" width="44" height="3" fill="currentColor" />
        <path
          d="M4.5 24C5.2 35.5 8.8 40.6 12.2 41.2h23.6c3.4-.6 7-5.7 7.7-17.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="10" y="41.4" width="3" height="1.4" rx="0.3" fill="currentColor" />
        <rect x="35" y="41.4" width="3" height="1.4" rx="0.3" fill="currentColor" />
      </g>
    </Coolicon>
  )
}

/**
 * Icons8 car glyph reconstructed from the user's icons8-car-48 PNG
 * (black silhouette on transparent; 48×48, opaque bbox 1–46 × 10–37).
 * Front-view: windshield ring, hood/body frame, two wheel rings, grille bar.
 * Official Icons8 SVG is paid. Coords are in 48-space, scaled into 24 viewBox.
 */
export function ParkingStatIcon({ size }: StatIconProps) {
  return (
    <Coolicon size={size}>
      <g fill="currentColor" transform="scale(0.5)">
        <path
          fillRule="evenodd"
          d="M14 10h16l3.6 2.6L36.2 19H7.8l2.6-6.4L14 10Zm1.2 3.1h13.8L31.6 19H12.6l2.6-5.9Z"
        />
        <path d="M5 19h33l5 1.8 2 1.4V31h-3V22H4v9H1V22.2L3 20.8 5 19z" />
        <path
          fillRule="evenodd"
          d="M11 27a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2.7a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6ZM35 27a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2.7a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6Z"
        />
        <rect x="14" y="31" width="18" height="3" />
      </g>
    </Coolicon>
  )
}
