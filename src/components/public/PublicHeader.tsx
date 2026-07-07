'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SIGN_IN_LINKS } from '@/lib/landing/content'

const NAV = [
  { href: '/#homes', label: 'Homes' },
  { href: '/#how', label: 'For owners' },
  { href: '/#how', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
]

interface PublicHeaderProps {
  /** When true, header starts transparent over a hero and solidifies on scroll. */
  overlay?: boolean
}

export function PublicHeader({ overlay = false }: PublicHeaderProps) {
  const [solid, setSolid] = useState(!overlay)
  const [signInOpen, setSignInOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!overlay) return
    const onScroll = () => setSolid(window.scrollY > 48)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [overlay])

  const hdrBg = solid ? 'rgba(253,251,246,.92)' : 'rgba(24,19,12,.22)'
  const hdrBorder = solid ? 'var(--border)' : 'rgba(244,239,230,.14)'
  const hdrText = solid ? 'var(--text)' : '#f4efe6'
  const hdrDim = solid ? 'var(--dim)' : 'rgba(244,239,230,.78)'

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: hdrBg,
        borderBottom: `1px solid ${hdrBorder}`,
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
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <Link href="/" title="Canary Property Management — home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: hdrText, flex: 'none' }}>
          <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--yellow)', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <Image src="/landing/logo-black.png" alt="" width={26} height={26} style={{ objectFit: 'contain' }} />
          </span>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>Canary</span>
        </Link>

        <nav aria-label="Main" className="cpub-nav" style={{ display: 'flex', gap: 2, flex: 'none' }}>
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="cl2-nav-link"
              style={{ textDecoration: 'none', color: hdrDim, fontWeight: 600, fontSize: '13.5px', padding: '7px 11px', borderRadius: 999 }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="cl2-btn-yellow"
              onClick={() => { setSignInOpen((v) => !v); setMobileOpen(false) }}
              style={{ border: 'none', background: 'var(--yellow)', color: 'var(--yellow-text)', borderRadius: 999, padding: '9px 18px', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}
            >
              Sign in
            </button>
            {signInOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 230,
                  background: 'var(--elev)',
                  color: 'var(--text)',
                  border: '1px solid var(--border2)',
                  borderRadius: 14,
                  boxShadow: 'var(--shadow)',
                  padding: 8,
                  zIndex: 60,
                }}
              >
                <div style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', padding: '6px 10px 8px' }}>
                  Choose your portal
                </div>
                {SIGN_IN_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="cl2-portal-link"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, textDecoration: 'none', color: 'inherit', fontWeight: 600, fontSize: '13.5px' }}
                  >
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
            aria-label="Open menu"
            onClick={() => { setMobileOpen((v) => !v); setSignInOpen(false) }}
            style={{
              display: 'none',
              width: 40,
              height: 40,
              borderRadius: 10,
              border: `1px solid ${solid ? 'var(--border)' : 'rgba(244,239,230,.3)'}`,
              background: solid ? 'var(--elev)' : 'rgba(244,239,230,.12)',
              color: hdrText,
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ☰
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--elev)', padding: '12px 16px 16px' }}>
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              style={{ display: 'block', padding: '10px 4px', textDecoration: 'none', color: 'var(--text)', fontWeight: 600 }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}
