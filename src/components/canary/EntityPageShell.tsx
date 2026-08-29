'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import '@/components/canary/canary.css'

export function useEntityBack(fallbackHref: string) {
  const router = useRouter()
  return useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(fallbackHref)
  }, [router, fallbackHref])
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

export function EntityPageShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('canary_theme')
      if (stored === 'light' || stored === 'dark') setTheme(stored)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <div className="cnry cy-shell cy-entity-shell" data-ui="macos27" data-theme={theme}>
      <div className="cy-entity-page">{children}</div>
    </div>
  )
}
