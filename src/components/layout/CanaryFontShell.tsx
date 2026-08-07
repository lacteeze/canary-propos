// Shared Instrument Sans + Plex Mono wrapper for Canary portal layouts
import type { ReactNode } from 'react'
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

export default function CanaryFontShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${instrumentSans.className} ${instrumentSans.variable} ${plexMono.variable}`}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%' }}
    >
      <style>{`:root { --font-instrument-sans: ${instrumentSans.style.fontFamily}; }`}</style>
      {children}
    </div>
  )
}
