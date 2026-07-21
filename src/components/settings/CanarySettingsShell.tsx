'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import '@/components/canary/canary.css'

export function CanarySettingsShell({ children }: { children: ReactNode }) {
  // Keep SSR and first client paint identical; apply saved theme after mount.
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem('canary_theme')
      if (stored === 'light' || stored === 'dark') setTheme(stored)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <div
      className="cnry cy-shell"
      data-ui="macos27"
      data-theme={theme}
      suppressHydrationWarning
    >
      <div className="cy-main-wrap">
        <header className="cy-header">
          <div className="cy-header-left">
            <Link href="/app" className="cy-header-brand cy-hov" title="Back to app">
              <span className="cy-header-brand-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/landing/logo-white.png"
                  alt=""
                  className="cy-settings-brand-logo cy-settings-brand-logo--dark"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/landing/logo-black.png"
                  alt=""
                  className="cy-settings-brand-logo cy-settings-brand-logo--light"
                />
              </span>
              <span className="cy-header-brand-title">
                Canary <span className="cy-header-brand-sub">PM</span>
              </span>
            </Link>
          </div>
          <div className="cy-header-tools">
            <Link href="/app" className="cy-btn-ghost">
              ← Back to app
            </Link>
          </div>
        </header>
        <main className="cy-main cy-settings-main" data-mounted={mounted ? '1' : '0'}>
          {children}
        </main>
      </div>
    </div>
  )
}
