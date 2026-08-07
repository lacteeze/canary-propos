'use client'

// Shared Canary portal shell — tenant / owner / vendor
import type { ComponentType, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import '@/design-system/macos27/index.css'
import '@/components/canary/canary.css'
import './portal.css'

export type PortalNavItem = {
  label: string
  href: string
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  /** Exact match only (e.g. /my-home home tab) */
  exact?: boolean
}

interface PortalShellProps {
  children: ReactNode
  orgName?: string
  userName?: string
  portalLabel: string
  homeHref: string
  navItems: PortalNavItem[]
}

export default function PortalShell({
  children,
  orgName = 'Canary',
  userName = 'User',
  portalLabel,
  homeHref,
  navItems,
}: PortalShellProps) {
  const pathname = usePathname()
  const initial = (userName.trim()[0] || 'U').toUpperCase()

  function isActive(item: PortalNavItem) {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="cnry cy-portal" data-ui="macos27" data-theme="light">
      <header className="cy-portal-header">
        <Link href={homeHref} className="cy-portal-header-brand" title={orgName}>
          <span className="cy-header-brand-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/logo-black.png"
              alt=""
              style={{ position: 'absolute', inset: 0, width: 28, height: 28, objectFit: 'contain' }}
            />
          </span>
          <span className="cy-portal-header-meta">
            <span className="cy-portal-header-title">
              {orgName.includes('Canary') ? (
                <>
                  Canary <span style={{ color: 'var(--dim)', fontWeight: 500 }}>PM</span>
                </>
              ) : (
                orgName
              )}
            </span>
            <span className="cy-portal-header-sub">{portalLabel}</span>
          </span>
        </Link>
        <button type="button" className="cy-btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <div className="cy-portal-body">
        <aside className="cy-portal-aside">
          <nav className="cy-portal-nav" aria-label="Portal">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="cy-portal-nav-link"
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={18} aria-hidden />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="cy-portal-user">
            <div className="cy-portal-avatar" aria-hidden>
              {initial}
            </div>
            <span className="text-sm truncate" style={{ color: 'var(--text)', fontSize: 13.5 }}>
              {userName}
            </span>
          </div>
        </aside>

        <main className="cy-portal-main">{children}</main>
      </div>

      <nav className="cy-portal-tabs" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="cy-portal-tab"
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
