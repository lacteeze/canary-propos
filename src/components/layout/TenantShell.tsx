'use client'

// src/components/layout/TenantShell.tsx
// Tenant portal shell — sidebar (desktop) + bottom tab bar (mobile)
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CreditCard, Wrench, FileText } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Home', href: '/my-home', icon: Home },
  { label: 'Pay Rent', href: '/pay-rent', icon: CreditCard },
  { label: 'Maintenance', href: '/my-home/maintenance', icon: Wrench },
  { label: 'My Lease', href: '/my-lease', icon: FileText },
]

interface TenantShellProps {
  children: ReactNode
}

export default function TenantShell({ children }: TenantShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#FAFAF9' }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0"
        style={{ backgroundColor: '#F5F4F2' }}
      >
        {/* Org logo + name */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-stone-200">
          <div className="w-8 h-8 rounded bg-stone-300 flex items-center justify-center text-xs font-semibold text-stone-600">
            C
          </div>
          <span className="text-base font-semibold text-stone-900 truncate">
            Canary PropOS
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'flex items-center gap-3 px-3 rounded-md min-h-11 text-sm transition-colors',
                  active
                    ? 'bg-white text-stone-900 font-semibold shadow-sm'
                    : 'text-stone-600 hover:bg-stone-200 hover:text-stone-900',
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User avatar */}
        <div className="px-4 py-4 border-t border-stone-200">
          <div className="flex items-center gap-3 min-h-11">
            <div className="w-8 h-8 rounded-full bg-stone-300 flex items-center justify-center text-xs font-semibold text-stone-600 shrink-0">
              T
            </div>
            <span className="text-sm text-stone-700 truncate">Tenant</span>
          </div>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 lg:ml-60 flex flex-col">
        <main className="flex-1 p-4 lg:p-8 max-w-[1280px] w-full mx-auto pb-20 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 border-t border-stone-200 flex"
        style={{ backgroundColor: '#F5F4F2' }}
        aria-label="Mobile navigation"
      >
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] text-xs transition-colors',
                active
                  ? 'text-amber-600 font-semibold'
                  : 'text-stone-500 hover:text-stone-900',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
