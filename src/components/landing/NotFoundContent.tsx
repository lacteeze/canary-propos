'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { fontDisplay } from '@/lib/landing/typography'

const REDIRECT_SECONDS = 10

export function NotFoundContent() {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS)

  useEffect(() => {
    const started = Date.now()
    const tick = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000)
      const left = Math.max(0, REDIRECT_SECONDS - elapsed)
      setSecondsLeft(left)
      if (left === 0) {
        window.clearInterval(tick)
        router.replace('/')
      }
    }, 250)

    return () => window.clearInterval(tick)
  }, [router])

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <Link
        href="/"
        aria-label="Canary Property Management home"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
          color: 'var(--text)',
          marginBottom: 36,
        }}
      >
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'var(--yellow)',
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
          }}
        >
          <Image
            src="/landing/logo-black.png"
            alt=""
            width={28}
            height={28}
            style={{ objectFit: 'contain' }}
          />
        </span>
        <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em' }}>
          Canary
        </span>
      </Link>

      <p
        style={{
          margin: '0 0 12px',
          fontFamily: "var(--font-ibm-plex-mono), 'IBM Plex Mono', monospace",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--dim)',
        }}
      >
        Error 404
      </p>

      <h1
        style={{
          margin: '0 0 14px',
          fontFamily: fontDisplay,
          fontWeight: 500,
          fontSize: 'clamp(32px, 6vw, 48px)',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: 'var(--text)',
          maxWidth: 520,
        }}
      >
        This page isn&apos;t available
      </h1>

      <p
        style={{
          margin: '0 0 28px',
          maxWidth: 420,
          color: 'var(--dim)',
          fontSize: 16,
          lineHeight: 1.55,
        }}
      >
        The page you requested could not be found. You&apos;ll be taken to the
        Canary home page in a moment.
      </p>

      <p
        role="status"
        aria-live="polite"
        style={{
          margin: '0 0 28px',
          color: 'var(--faint)',
          fontSize: 14,
        }}
      >
        {secondsLeft > 0
          ? `Redirecting to the home page in ${secondsLeft} second${secondsLeft === 1 ? '' : 's'}.`
          : 'Redirecting to the home page…'}
      </p>

      <Link
        href="/"
        className="cl2-btn-yellow"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          background: 'var(--yellow)',
          color: 'var(--yellow-text)',
          borderRadius: 999,
          padding: '14px 28px',
          fontWeight: 700,
          fontSize: 15.5,
          boxShadow: '0 10px 30px rgba(240,196,69,.35)',
        }}
      >
        Go to home page
      </Link>
    </main>
  )
}
