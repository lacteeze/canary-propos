'use client'

// Shared Canary portal shell — tenant / owner / vendor
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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
  const [theme, setTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    try {
      const t = localStorage.getItem('canary_theme')
      if (t === 'light' || t === 'dark') setTheme(t)
    } catch {
      /* ignore */
    }
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem('canary_theme', next)
    } catch {
      /* ignore */
    }
  }

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
    <div className="cnry cy-portal" data-ui="macos27" data-theme={theme}>
      <header className="cy-portal-header">
        <Link href={homeHref} className="cy-portal-header-brand" title={orgName}>
          <span className="cy-header-brand-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/logo-white.png"
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: 28,
                height: 28,
                objectFit: 'contain',
                display: theme === 'dark' ? 'block' : 'none',
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/logo-black.png"
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: 28,
                height: 28,
                objectFit: 'contain',
                display: theme === 'dark' ? 'none' : 'block',
              }}
            />
          </span>
          <span className="cy-portal-header-meta">
            <span className="cy-portal-header-title">
              {orgName.includes('Canary') ? (
                <>
                  Canary <span className="cy-header-brand-sub">PM</span>
                </>
              ) : (
                orgName
              )}
            </span>
            <span className="cy-portal-header-sub">{portalLabel}</span>
          </span>
        </Link>

        <div className="cy-header-tools">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="cy-messages-toggle"
              aria-label="Messages"
              title="Messages"
            >
              <MessageSquare size={16} strokeWidth={2} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              data-theme={theme}
              className="cnry cy-menu cy-portal-panel-menu min-w-64"
            >
              <DropdownMenuLabel>Messages</DropdownMenuLabel>
              <div className="cy-portal-panel-empty">
                No messages yet. Conversations with your property manager will appear here.
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="cy-messages-toggle"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={16} strokeWidth={2} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              data-theme={theme}
              className="cnry cy-menu cy-portal-panel-menu min-w-64"
            >
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <div className="cy-portal-panel-empty">
                No notifications yet. Alerts for payments, approvals, and updates will appear here.
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="cy-header-actions">
            <DropdownMenu>
              <DropdownMenuTrigger className="cy-profile-trigger" aria-label="Account menu">
                <span className="cy-profile-avatar" aria-hidden>
                  {userInitials(userName)}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                data-theme={theme}
                className="cnry cy-menu cy-profile-menu min-w-56"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{userName}</DropdownMenuLabel>
                  <div className="cy-portal-profile-role">{portalLabel}</div>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={toggleTheme}>
                    {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    <span className="cy-profile-menu-hint" aria-hidden>
                      {theme === 'dark' ? '☀' : '☾'}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
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
              {userInitials(userName)}
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
