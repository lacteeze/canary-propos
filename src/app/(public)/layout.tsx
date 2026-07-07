// src/app/(public)/layout.tsx
// Layout for the (public) route group — no auth, no sidebar.
// Applies the landing page's branding (fonts + palette) and the shared
// public header so public pages feel continuous with the marketing site.
import type { ReactNode } from 'react'
import { Instrument_Sans, Instrument_Serif, IBM_Plex_Mono } from 'next/font/google'
import { PublicHeader } from '@/components/public/PublicHeader'
import '@/components/public/public-theme.css'

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
      className={`cpub ${instrumentSans.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable}`}
      style={{ fontFamily: 'var(--font-instrument-sans), system-ui, sans-serif' }}
    >
      <PublicHeader overlay />
      <main>{children}</main>
    </div>
  )
}
