// src/app/(canary)/layout.tsx
// Layout for the CanaryApp backend portal — loads the design's fonts.
import { IBM_Plex_Mono, Instrument_Sans } from 'next/font/google'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-sans',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
})

export const metadata = {
  title: 'Canary PM',
  description: 'Canary property management',
}

export default function CanaryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${instrumentSans.className} ${instrumentSans.variable} ${plexMono.variable}`}
      style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      {/* Expose Instrument Sans to portaled menus (dropdowns render under body) */}
      <style>{`:root { --font-instrument-sans: ${instrumentSans.style.fontFamily}; }`}</style>
      {children}
    </div>
  )
}
