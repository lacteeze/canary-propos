'use client'

// src/components/layout/TenantShell.tsx
// Tenant portal shell — Canary-styled sidebar (desktop) + bottom tabs (mobile)
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CreditCard, Wrench, Receipt } from 'lucide-react'
import '@/components/canary/canary.css'

const NAV_ITEMS = [
  { label: 'Home', href: '/my-home', icon: Home },
  { label: 'Pay', href: '/my-home/pay', icon: CreditCard },
  { label: 'Payments', href: '/my-home/payments', icon: Receipt },
  { label: 'Maintenance', href: '/my-home/maintenance', icon: Wrench },
]

interface TenantShellProps {
  children: ReactNode
  orgName?: string
  tenantName?: string
}

export default function TenantShell({
  children,
  orgName = 'Canary',
  tenantName = 'Tenant',
}: TenantShellProps) {
  const pathname = usePathname()
  const initial = (tenantName.trim()[0] || 'T').toUpperCase()
  const orgInitial = (orgName.trim()[0] || 'C').toUpperCase()

  return (
    <div className="cnry" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="min-h-screen flex">
        {/* Desktop sidebar */}
        <aside
          className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0"
          style={{
            background: 'var(--panel)',
            borderRight: '1px solid var(--border)',
          }}
        >
          <div
            className="flex items-center gap-3 px-6 py-5"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
            >
              {orgInitial}
            </div>
            <div className="min-w-0">
              <div
                className="text-sm font-semibold truncate"
                style={{ color: 'var(--text)' }}
              >
                {orgName}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--faint)' }}>
                Tenant portal
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active =
                href === '/my-home'
                  ? pathname === '/my-home'
                  : pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 rounded-md min-h-11 text-sm transition-colors"
                  style={{
                    background: active ? 'var(--hover)' : 'transparent',
                    color: active ? 'var(--text)' : 'var(--dim)',
                    fontWeight: active ? 600 : 500,
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="px-4 py-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 min-h-11">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{ background: 'var(--elev)', color: 'var(--dim)' }}
              >
                {initial}
              </div>
              <span className="text-sm truncate" style={{ color: 'var(--text)' }}>
                {tenantName}
              </span>
            </div>
          </div>
        </aside>

        <div className="flex-1 lg:ml-60 flex flex-col">
          <main className="flex-1 p-4 lg:p-8 max-w-[1280px] w-full mx-auto pb-20 lg:pb-8">
            {children}
          </main>
        </div>

        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 flex"
          style={{
            background: 'var(--panel)',
            borderTop: '1px solid var(--border)',
          }}
          aria-label="Mobile navigation"
        >
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active =
              href === '/my-home'
                ? pathname === '/my-home'
                : pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] text-xs transition-colors"
                style={{
                  color: active ? 'var(--accent)' : 'var(--faint)',
                  fontWeight: active ? 600 : 500,
                }}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
