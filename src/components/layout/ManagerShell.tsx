'use client'

// src/components/layout/ManagerShell.tsx
// Legacy shell for leftover detail pages only. Nav escapes to CanaryApp.
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Wrench,
  CreditCard,
  Settings,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/app', icon: LayoutDashboard },
  { label: 'Properties', href: '/app?view=properties', icon: Building2 },
  { label: 'People', href: '/app?view=people', icon: Users },
  { label: 'Leases', href: '/app?view=leases', icon: FileText },
  { label: 'Maintenance', href: '/app?view=projects', icon: Wrench },
  { label: 'Payments', href: '/app?view=payments', icon: CreditCard },
  { label: 'Settings', href: '/settings', icon: Settings },
]

const MOBILE_NAV_ITEMS = NAV_ITEMS.slice(0, 5)

interface ManagerShellProps {
  children: ReactNode
}

export default function ManagerShell({ children }: ManagerShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#FAFAF9' }}>
      <aside
        className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0"
        style={{ backgroundColor: '#F5F4F2' }}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-stone-200">
          <div className="w-8 h-8 rounded bg-stone-300 flex items-center justify-center text-xs font-semibold text-stone-600">
            C
          </div>
          <span className="text-base font-semibold text-stone-900 truncate">
            Canary PropOS
          </span>
        </div>

        <div className="mx-3 mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Legacy detail view — use Canary for lists and new work.
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const pathOnly = href.split('?')[0]
            const active = pathname === pathOnly || pathname.startsWith(pathOnly + '/')
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

        <div className="px-4 py-4 border-t border-stone-200">
          <div className="flex items-center gap-3 min-h-11">
            <div className="w-8 h-8 rounded-full bg-stone-300 flex items-center justify-center text-xs font-semibold text-stone-600 shrink-0">
              U
            </div>
            <span className="text-sm text-stone-700 truncate">Manager</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:ml-60 flex flex-col">
        <main className="flex-1 p-4 lg:p-8 max-w-[1280px] w-full mx-auto pb-20 lg:pb-8">
          {children}
        </main>
      </div>

      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 border-t border-stone-200 flex"
        style={{ backgroundColor: '#F5F4F2' }}
        aria-label="Mobile navigation"
      >
        {MOBILE_NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const pathOnly = href.split('?')[0]
          const active = pathname === pathOnly || pathname.startsWith(pathOnly + '/')
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
