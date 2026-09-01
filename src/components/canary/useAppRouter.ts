'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { beginAppNav } from '@/lib/canary/app-nav'

export function useAppRouter() {
  const router = useRouter()
  return useMemo(
    () => ({
      prefetch: router.prefetch.bind(router),
      refresh: router.refresh.bind(router),
      replace(href: string) {
        beginAppNav()
        router.replace(href)
      },
      push(href: string) {
        beginAppNav()
        router.push(href)
      },
      back() {
        beginAppNav()
        router.back()
      },
    }),
    [router],
  )
}
