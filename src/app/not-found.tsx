import type { Metadata } from 'next'
import { Instrument_Sans, IBM_Plex_Mono } from 'next/font/google'
import { NotFoundContent } from '@/components/landing/NotFoundContent'
import '@/components/landing/landing-styles.css'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
})

export const metadata: Metadata = {
  title: "Page not found — Canary Property Management",
  description:
    "This page isn't available. You'll be redirected to the Canary Property Management home page.",
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <>
      {/* Fallback redirect if client JS is unavailable */}
      <meta httpEquiv="refresh" content="10;url=/" />
      <div
        className={`cland2 ${instrumentSans.variable} ${ibmPlexMono.variable}`}
        style={{
          minHeight: '100vh',
          width: '100%',
          background: 'var(--bg)',
          color: 'var(--text)',
          fontFamily:
            "var(--font-instrument-sans), 'Instrument Sans', system-ui, sans-serif",
          fontSize: '15.5px',
          lineHeight: 1.55,
        }}
      >
        <NotFoundContent />
      </div>
    </>
  )
}
