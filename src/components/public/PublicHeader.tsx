'use client'
// src/components/public/PublicHeader.tsx
// Shared header for public-facing pages (listing detail, etc.).
// Visually mirrors the landing page header (logo mark, nav, sign-in menu)
// without touching the landing page's own implementation.

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SIGN_IN_LINKS } from '@/lib/landing/content'

const NAV_LINKS = [
  { href: '/#homes', label: 'Homes' },
  { href: '/#how', label: 'Owners' },
  { href: '/#how', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
]

interface PublicHeaderProps {
  /** When true the header floats transparently over a dark hero and turns
   *  solid on scroll — same behaviour as the landing page header. */
  overlay?: boolean
}

export function PublicHeader({ overlay = false }: PublicHeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!overlay) return
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [overlay])

  const solid = !overlay || scrolled || mobileOpen
  const hdr = {
    bg: solid ? 'rgba(253,251,246,.88)' : 'rgba(24,19,12,.18)',
    border: solid ? 'var(--border)' : 'rgba(244,239,230,.14)',
    text: solid ? 'var(--text)' : '#f4efe6',
    dim: solid ? 'var(--dim)' : 'rgba(244,239,230,.75)',
    ctlBg: solid ? 'var(--elev)' : 'rgba(244,239,230,.14)',
    ctlBorder: solid ? 'var(--border)' : 'rgba(244,239,230,.3)',
  }

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: hdr.bg,
        borderBottom: `1px solid ${hdr.border}`,
        backdropFilter: 'blur(14px)',
        transition: 'background .3s, border-color .3s',
      }}
    >
      <div
        style={{
          maxWidth: 1380,
          margin: '0 auto',
          padding: '12px clamp(16px, 4vw, 26px)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/"
          title="Canary Property Management — home"
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: hdr.text, flex: 'none' }}
        >
          <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--yellow)', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <Image src="/landing/logo-black.png" alt="Canary Property Management logo" width={26} height={26} style={{ objectFit: 'contain' }} />
          </span>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>Canary</span>
        </Link>

        <nav aria-label="Main" className="cpub-nav" style={{ display: 'flex', gap: 2, flex: 'none' }}>
          {NAV_LINKS.map((item) => (
            <Link key={item.label} href={item.href} className="cpub-nav-link" style={{ color: hdr.dim }}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="cpub-hdrctl" style={{ position: 'relative', flex: 'none', marginLeft: 'auto' }}>
          <button
            type="button"
            className="cpub-btn-yellow"
            onClick={() => setSignInOpen(!signInOpen)}
            style={{ padding: '9px 18px', fontSize: '13.5px' }}
          >
            Sign in
          </button>
          {signInOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 230, background: 'var(--elev)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 14, boxShadow: 'var(--shadow)', padding: 8, zIndex: 60 }}>
              <div style={{ fontFamily: "var(--font-ibm-plex-mono), 'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', padding: '6px 10px 8px' }}>
                Choose your portal
              </div>
              {SIGN_IN_LINKS.map((link) => (
                <Link key={link.label} href={link.href} className="cpub-portal-link">
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: link.dot, flex: 'none' }} />
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="cpub-burger"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
          style={{ flex: 'none', width: 38, height: 38, borderRadius: 10, border: `1px solid ${hdr.ctlBorder}`, background: hdr.ctlBg, color: hdr.text, cursor: 'pointer', placeItems: 'center', fontSize: 17, lineHeight: 1, marginLeft: 'auto' }}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {mobileOpen && (
        <div style={{ borderTop: `1px solid ${hdr.border}`, padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <nav aria-label="Mobile" style={{ display: 'flex', flexDirection: 'column' }}>
            {NAV_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                style={{ textDecoration: 'none', color: hdr.text, fontWeight: 700, fontSize: 16, padding: '11px 2px', borderBottom: `1px solid ${hdr.border}` }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/login" style={{ textDecoration: 'none', background: 'var(--yellow)', color: 'var(--yellow-text)', borderRadius: 999, padding: '11px 20px', fontWeight: 700, fontSize: 14 }}>
              Sign in
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
