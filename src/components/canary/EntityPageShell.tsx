'use client'

import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import NavProgress from './NavProgress'
import { useAppRouter } from './useAppRouter'
import { Bell, ChevronDown, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CanaryRole } from '@/lib/canary/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AppSidebar, MobileAppChrome, pageLabelForView } from './AppSidebar'
import '@/components/canary/canary.css'

export type EntityChrome = {
  role: CanaryRole
  priv: boolean
  userName: string
  userEmail: string
  userAvatarUrl?: string | null
}

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export function useEntityBack(fallbackHref: string) {
  const router = useAppRouter()
  return useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    const origin =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('view')
        : null
    if (origin) {
      router.push(`/app?view=${encodeURIComponent(origin)}`)
      return
    }
    router.push(fallbackHref)
  }, [router, fallbackHref])
}

export function CanaryChromeNotice({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="cnry cy-shell" data-theme="light">
      <aside className="cy-sidebar" aria-hidden>
        <div className="cy-sidebar-head">
          <span className="cy-sidebar-brand-text">Canary</span>
        </div>
      </aside>
      <div className="cy-main-wrap">
        <main className="cy-main">
          <div style={{ padding: 24, maxWidth: 520 }}>
            <h1 style={{ fontSize: 22, fontWeight: 650, margin: 0 }}>{title}</h1>
            <div style={{ marginTop: 12, color: 'var(--dim)', lineHeight: 1.5 }}>{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}

export function CanaryChromeSkeleton({ title = 'Loading' }: { title?: string }) {
  return (
    <div className="cnry cy-shell" data-theme="light">
      <aside className="cy-sidebar" aria-hidden>
        <div className="cy-sidebar-head">
          <span className="cy-sidebar-brand-text">Canary</span>
        </div>
      </aside>
      <div className="cy-main-wrap">
        <main className="cy-main" aria-busy="true" aria-label={title}>
          <div style={{ padding: 24, maxWidth: 720 }}>
            <div
              style={{
                height: 28,
                width: 200,
                background: 'var(--border)',
                borderRadius: 6,
              }}
            />
            <div
              style={{
                height: 14,
                width: '70%',
                background: 'var(--border)',
                borderRadius: 6,
                marginTop: 20,
              }}
            />
            <div
              style={{
                height: 14,
                width: '46%',
                background: 'var(--border)',
                borderRadius: 6,
                marginTop: 12,
              }}
            />
            <div
              style={{
                height: 180,
                width: '100%',
                background: 'var(--border)',
                borderRadius: 8,
                marginTop: 28,
              }}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

export function EntityBackButton({
  onClick,
  label = 'Back',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      className="cy-property-modal-back-btn"
      onClick={onClick}
      aria-label={label}
    >
      ← {label}
    </button>
  )
}

export function EntityPageShell({
  children,
  chrome,
  activeView,
  pageTitle,
}: {
  children: ReactNode
  chrome: EntityChrome
  activeView: string
  pageTitle: string
}) {
  const router = useAppRouter()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const isNarrow = useMediaQuery('(max-width: 768px)')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('canary_theme')
      if (stored === 'light' || stored === 'dark') setTheme(stored)
      if (localStorage.getItem('canary_sidebar_collapsed') === '1') setSidebarCollapsed(true)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!moreOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [moreOpen])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('canary_sidebar_collapsed', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const navigateView = useCallback(
    (key: string) => {
      setMoreOpen(false)
      router.push(`/app?view=${encodeURIComponent(key)}`)
    },
    [router],
  )

  const openSearch = useCallback(() => {
    setMoreOpen(false)
    router.push('/app')
  }, [router])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem('canary_theme', next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const accountMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger className="cy-sidebar-profile" aria-label="Account menu">
        <span className="cy-profile-avatar" aria-hidden>
          {chrome.userAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={chrome.userAvatarUrl} alt="" />
          ) : (
            userInitials(chrome.userName || chrome.role)
          )}
        </span>
        <span className="cy-sidebar-profile-copy">
          <span className="cy-sidebar-profile-name">{chrome.userName || chrome.role}</span>
          <span className="cy-sidebar-profile-meta">{chrome.userEmail || chrome.role}</span>
        </span>
        <ChevronDown size={14} className="cy-sidebar-profile-chevron" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        data-theme={theme}
        className="cnry cy-menu cy-profile-menu min-w-56"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => { window.location.href = '/settings' }}>
            <Settings size={15} aria-hidden />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => window.open('https://canary-propos.vercel.app', '_blank', 'noopener,noreferrer')}
          >
            Public site
            <span className="cy-profile-menu-hint" aria-hidden>↗</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigateView('notifications')}>
            <Bell size={15} aria-hidden />
            Notifications
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            <span className="cy-profile-menu-hint" aria-hidden>
              {theme === 'dark' ? '☀' : '☾'}
            </span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={signOut}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div
      className="cnry cy-shell cy-entity-shell"
      data-ui="macos27"
      data-theme={theme}
      data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'}
    >
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <AppSidebar
        theme={theme}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        view={activeView}
        onNavigate={navigateView}
        priv={chrome.priv}
        role={chrome.role}
        searchQuery=""
        onOpenSearch={openSearch}
        footer={accountMenu}
      />
      <div className="cy-main-wrap">
        {isNarrow ? (
          <MobileAppChrome
            theme={theme}
            view={activeView}
            title={pageTitle || pageLabelForView(activeView, chrome.priv, chrome.role)}
            moreOpen={moreOpen}
            onMoreChange={setMoreOpen}
            onNavigate={navigateView}
            onOpenSearch={openSearch}
            searchQuery=""
            priv={chrome.priv}
            role={chrome.role}
            footer={accountMenu}
          />
        ) : null}
        <div className="cy-entity-page">{children}</div>
      </div>
    </div>
  )
}
