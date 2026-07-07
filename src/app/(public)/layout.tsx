// src/app/(public)/layout.tsx
// Shared layout for public listing detail pages — landing-page fonts and theme.
import type { ReactNode } from 'react'
import { Instrument_Sans, Instrument_Serif, IBM_Plex_Mono } from 'next/font/google'
import '@/components/landing/landing-styles.css'
import '@/components/public/public-styles.css'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
})

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`cland2 ${instrumentSans.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable}`}
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: "var(--font-instrument-sans), 'Instrument Sans', system-ui, sans-serif",
        fontSize: '15.5px',
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  )
}
