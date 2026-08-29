'use client'

import React from 'react'
import {
  Banknote,
  Bell,
  Building2,
  CheckSquare,
  FolderKanban,
  KeyRound,
  LayoutGrid,
  Mail,
  Menu,
  MessageSquare,
  PanelLeft,
  Receipt,
  Search,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { CanaryRole } from '@/lib/canary/types'

export type AppNavItem = {
  key: string
  label: string
  icon: LucideIcon
  privOnly?: boolean
  hideFor?: CanaryRole[]
  href?: string
}

export type AppNavSection = {
  id: string
  label: string
  items: AppNavItem[]
}

export const APP_NAV_SECTIONS: AppNavSection[] = [
  {
    id: 'main',
    label: 'Main',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, hideFor: ['Vendor'] },
      { key: 'leases', label: 'Leasing', icon: KeyRound, hideFor: ['Vendor'] },
      { key: 'properties', label: 'Properties', icon: Building2, hideFor: ['Vendor'] },
      { key: 'people', label: 'People', icon: Users, privOnly: true },
      { key: 'portfolios', label: 'Portfolios', icon: Wallet, privOnly: true },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    items: [
      { key: 'projects', label: 'Projects', icon: FolderKanban },
      { key: 'tasks', label: 'Tasks', icon: CheckSquare, hideFor: ['Tenant'] },
      { key: 'payments', label: 'Payments', icon: Banknote, hideFor: ['Vendor'] },
      { key: 'billing', label: 'Billing', icon: Receipt, privOnly: true, hideFor: ['Vendor', 'Tenant'] },
    ],
  },
  {
    id: 'inbox',
    label: 'Inbox',
    items: [
      { key: 'inbox', label: 'Email', icon: Mail, privOnly: true },
      { key: 'messages', label: 'Messages', icon: MessageSquare, privOnly: true },
      { key: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    items: [
      { key: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
    ],
  },
]

const MOBILE_TAB_ORDER = ['dashboard', 'leases', 'properties', 'tasks', 'projects'] as const

export function visibleNavItems(priv: boolean, role: CanaryRole): AppNavItem[] {
  return APP_NAV_SECTIONS.flatMap((section) =>
    section.items.filter((item) => !(item.privOnly && !priv) && !(item.hideFor && item.hideFor.includes(role))),
  )
}

export function visibleNavSections(priv: boolean, role: CanaryRole): AppNavSection[] {
  return APP_NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !(item.privOnly && !priv) && !(item.hideFor && item.hideFor.includes(role))),
    }))
    .filter((section) => section.items.length > 0)
}

export function mobileTabItems(priv: boolean, role: CanaryRole): AppNavItem[] {
  const visible = visibleNavItems(priv, role)
  const picked: AppNavItem[] = []
  for (const key of MOBILE_TAB_ORDER) {
    const item = visible.find((n) => n.key === key)
    if (item) picked.push(item)
    if (picked.length === 4) break
  }
  return picked
}

export function pageLabelForView(view: string, priv: boolean, role: CanaryRole): string {
  return visibleNavItems(priv, role).find((item) => item.key === view)?.label ?? 'Canary'
}

function shortcutHint() {
  if (typeof navigator === 'undefined') return '⌘K'
  return /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'
}

type AppSidebarProps = {
  theme: 'light' | 'dark'
  collapsed: boolean
  onToggleCollapsed: () => void
  view: string
  onNavigate: (key: string) => void
  priv: boolean
  role: CanaryRole
  searchQuery: string
  onOpenSearch: () => void
  searchSlot?: React.ReactNode
  footer: React.ReactNode
}

export function AppSidebar({
  theme,
  collapsed,
  onToggleCollapsed,
  view,
  onNavigate,
  priv,
  role,
  searchQuery,
  onOpenSearch,
  searchSlot,
  footer,
}: AppSidebarProps) {
  const sections = visibleNavSections(priv, role)
  const hint = shortcutHint()

  const go = (item: AppNavItem) => {
    if (item.href) {
      window.location.href = item.href
      return
    }
    onNavigate(item.key)
  }

  return (
    <aside
      className={`cy-sidebar${collapsed ? ' cy-sidebar--collapsed' : ''}`}
      data-theme={theme}
      aria-label="App"
    >
      <div className="cy-sidebar-head">
        <button
          type="button"
          className="cy-sidebar-brand"
          onClick={() => onNavigate(role === 'Vendor' ? 'projects' : 'dashboard')}
          title="Dashboard"
        >
          <span className="cy-sidebar-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo-white.png" alt="" className="cy-sidebar-logo-img cy-sidebar-logo-img--dark" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo-black.png" alt="" className="cy-sidebar-logo-img cy-sidebar-logo-img--light" />
          </span>
          <span className="cy-sidebar-brand-text">
            Canary <span className="cy-sidebar-brand-sub">PM</span>
          </span>
        </button>
        <button
          type="button"
          className="cy-sidebar-collapse"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          <PanelLeft size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="cy-sidebar-search-wrap">
        {searchSlot ?? (
          <button
            type="button"
            className={`cy-sidebar-search${searchQuery ? ' cy-sidebar-search--live' : ''}`}
            onClick={onOpenSearch}
            aria-label={searchQuery ? `Search: ${searchQuery}` : 'Search anything'}
            title={searchQuery || 'Search anything'}
          >
            <Search size={16} strokeWidth={2} aria-hidden />
            <span className="cy-sidebar-search-text">{searchQuery || 'Search anything'}</span>
            <kbd className="cy-sidebar-kbd">{hint}</kbd>
          </button>
        )}
      </div>

      <nav className="cy-sidebar-nav" aria-label="Main">
        {sections.map((section) => (
          <div key={section.id} className="cy-sidebar-section">
            <div className="cy-sidebar-section-label">{section.label}</div>
            {section.items.map((item) => {
              const Icon = item.icon
              const active = !item.href && view === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`cy-sidebar-item${active ? ' cy-sidebar-item--active' : ''}`}
                  onClick={() => go(item)}
                  title={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={1.75} aria-hidden />
                  <span className="cy-sidebar-item-label">{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="cy-sidebar-foot">{footer}</div>
    </aside>
  )
}

type MobileChromeProps = {
  theme: 'light' | 'dark'
  view: string
  title: string
  moreOpen: boolean
  onMoreChange: (open: boolean) => void
  onNavigate: (key: string) => void
  onOpenSearch: () => void
  searchQuery: string
  priv: boolean
  role: CanaryRole
  footer: React.ReactNode
}

export function MobileAppChrome({
  theme,
  view,
  title,
  moreOpen,
  onMoreChange,
  onNavigate,
  onOpenSearch,
  searchQuery,
  priv,
  role,
  footer,
}: MobileChromeProps) {
  const tabs = mobileTabItems(priv, role)
  const tabKeys = new Set(tabs.map((t) => t.key))
  const moreActive = moreOpen || !tabKeys.has(view)
  const sections = visibleNavSections(priv, role)

  const go = (item: AppNavItem) => {
    onMoreChange(false)
    if (item.href) {
      window.location.href = item.href
      return
    }
    onNavigate(item.key)
  }

  return (
    <>
      <header className="cy-mobile-topbar">
        <div className="cy-mobile-topbar-title">{title}</div>
        <button
          type="button"
          className={`cy-mobile-search${searchQuery ? ' cy-mobile-search--live' : ''}`}
          onClick={onOpenSearch}
          aria-label={searchQuery ? `Search: ${searchQuery}` : 'Search'}
        >
          <Search size={18} strokeWidth={2} aria-hidden />
          {searchQuery ? <span className="cy-mobile-search-q">{searchQuery}</span> : null}
        </button>
      </header>

      {moreOpen && (
        <div className="cy-more-root">
          <button
            type="button"
            className="cy-more-backdrop"
            aria-label="Close menu"
            onClick={() => onMoreChange(false)}
          />
          <div
            className="cy-more-sheet"
            data-theme={theme}
            role="dialog"
            aria-modal="true"
            aria-label="More"
          >
            <div className="cy-more-handle" aria-hidden />
            <button type="button" className="cy-sidebar-search" onClick={onOpenSearch}>
              <Search size={16} strokeWidth={2} aria-hidden />
              <span className="cy-sidebar-search-text">{searchQuery || 'Search anything'}</span>
            </button>
            <nav className="cy-more-nav" aria-label="All pages">
              {sections.map((section) => (
                <div key={section.id} className="cy-sidebar-section">
                  <div className="cy-sidebar-section-label">{section.label}</div>
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const active = !item.href && view === item.key
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`cy-sidebar-item${active ? ' cy-sidebar-item--active' : ''}`}
                        onClick={() => go(item)}
                      >
                        <Icon size={18} strokeWidth={1.75} aria-hidden />
                        <span className="cy-sidebar-item-label">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>
            <div className="cy-more-foot">{footer}</div>
          </div>
        </div>
      )}

      <nav className="cy-tabbar" aria-label="Primary">
        {tabs.map((item) => {
          const Icon = item.icon
          const active = !moreOpen && view === item.key
          return (
            <button
              key={item.key}
              type="button"
              className={`cy-tabbar-item${active ? ' cy-tabbar-item--active' : ''}`}
              onClick={() => {
                onMoreChange(false)
                onNavigate(item.key)
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.75} aria-hidden />
              <span>{item.label}</span>
            </button>
          )
        })}
        <button
          type="button"
          className={`cy-tabbar-item${moreActive ? ' cy-tabbar-item--active' : ''}`}
          onClick={() => onMoreChange(!moreOpen)}
          aria-expanded={moreOpen}
        >
          <Menu size={22} strokeWidth={moreActive ? 2.2 : 1.75} aria-hidden />
          <span>More</span>
        </button>
      </nav>
    </>
  )
}
