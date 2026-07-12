// src/app/(public)/layout.tsx
// Shared layout for public listing detail pages — landing-page fonts and theme.
import type { ReactNode } from 'react'
import { Instrument_Sans, IBM_Plex_Mono } from 'next/font/google'
import { PublicThemeProvider } from '@/components/public/PublicThemeProvider'
import '@/components/landing/landing-styles.css'
import '@/components/public/public-styles.css'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
})

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <PublicThemeProvider
      className={`${instrumentSans.variable} ${ibmPlexMono.variable}`}
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
    </PublicThemeProvider>
  )
}
