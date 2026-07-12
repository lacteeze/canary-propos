'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

export type PublicTheme = 'light' | 'dark'

type PublicThemeContextValue = {
  theme: PublicTheme
  dark: boolean
  setTheme: (theme: PublicTheme) => void
  toggleTheme: () => void
}

const PublicThemeContext = createContext<PublicThemeContextValue | null>(null)

const STORAGE_KEY = 'canary_land_theme'

export function PublicThemeProvider({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const [theme, setThemeState] = useState<PublicTheme>('light')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'dark' || saved === 'light') setThemeState(saved)
    } catch {
      // ignore
    }
  }, [])

  const setTheme = useCallback((next: PublicTheme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  return (
    <PublicThemeContext.Provider value={{ theme, dark: theme === 'dark', setTheme, toggleTheme }}>
      <div
        className={`cland2${theme === 'dark' ? ' cl2-dark' : ''}${className ? ` ${className}` : ''}`}
        style={style}
      >
        {children}
      </div>
    </PublicThemeContext.Provider>
  )
}

export function usePublicTheme(): PublicThemeContextValue {
  const ctx = useContext(PublicThemeContext)
  if (!ctx) {
    return {
      theme: 'light',
      dark: false,
      setTheme: () => {},
      toggleTheme: () => {},
    }
  }
  return ctx
}
