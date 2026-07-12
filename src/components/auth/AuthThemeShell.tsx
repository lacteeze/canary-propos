'use client'

import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const LAND_THEME_KEY = 'canary_land_theme'
const APP_THEME_KEY = 'canary_theme'

function readStoredTheme(): 'light' | 'dark' {
  try {
    const land = localStorage.getItem(LAND_THEME_KEY)
    if (land === 'dark' || land === 'light') return land
    const app = localStorage.getItem(APP_THEME_KEY)
    if (app === 'dark' || app === 'light') return app
  } catch {
    // ignore
  }
  return 'light'
}

export function AuthThemeShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useLayoutEffect(() => {
    setTheme(readStoredTheme())
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAND_THEME_KEY || e.key === APP_THEME_KEY) {
        setTheme(readStoredTheme())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const dark = theme === 'dark'

  return (
    <div
      className={`cnry${className ? ` ${className}` : ''}`}
      data-theme={theme}
      data-ui="macos27"
      suppressHydrationWarning
    >
      <div className="auth-shell">
        <Link href="/" className="auth-brand" title="Canary Property Management — home">
          <Image
            src={dark ? '/landing/logo-white.png' : '/landing/logo-black.png'}
            alt="Canary Property Management logo"
            width={36}
            height={36}
            style={{ objectFit: 'contain' }}
            priority
          />
          <span className="auth-brand-name">
            Canary <span>PM</span>
          </span>
        </Link>
        {children}
      </div>
    </div>
  )
}
