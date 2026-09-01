'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { endAppNav, subscribeAppNav } from '@/lib/canary/app-nav'

export default function NavProgress({ pending = false }: { pending?: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [routePending, setRoutePending] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => subscribeAppNav(setRoutePending), [])

  useEffect(() => {
    endAppNav()
  }, [pathname, searchParams])

  const active = pending || routePending

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    const show = window.setTimeout(() => setVisible(true), 80)
    const failsafe = window.setTimeout(() => endAppNav(), 15000)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(failsafe)
    }
  }, [active])

  if (!visible) return null

  return (
    <div className="cy-nav-progress" role="status" aria-live="polite" aria-busy="true">
      <div className="cy-nav-progress-bar" />
      <span className="cy-nav-progress-label">Opening…</span>
    </div>
  )
}
