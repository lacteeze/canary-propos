'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadViewLayout, reconcileOrder, saveViewLayout } from './storage'
import type { LayoutSize, ViewLayoutState } from './types'

export function useViewLayout(viewKey: string, itemIds: string[], userKey?: string | null) {
  const itemKey = itemIds.join('|')
  const [state, setState] = useState<ViewLayoutState>(() => ({
    order: itemIds,
    sizes: {},
  }))
  const hydrated = useRef(false)
  const skipSave = useRef(true)

  // Hydrate from localStorage once per view/user
  useEffect(() => {
    const saved = loadViewLayout(viewKey, userKey)
    hydrated.current = true
    skipSave.current = true
    setState(() => {
      const order = reconcileOrder(saved?.order, itemIds)
      return {
        order,
        sizes: saved?.sizes || {},
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate on view/user change only
  }, [viewKey, userKey])

  // Keep order in sync when items appear/disappear
  useEffect(() => {
    setState((prev) => {
      const order = reconcileOrder(prev.order, itemIds)
      if (order.length === prev.order.length && order.every((id, i) => id === prev.order[i])) return prev
      return { ...prev, order }
    })
  }, [itemKey, itemIds])

  // Persist
  useEffect(() => {
    if (!hydrated.current) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    saveViewLayout(viewKey, state, userKey)
  }, [state, viewKey, userKey])

  const orderedIds = useMemo(() => reconcileOrder(state.order, itemIds), [state.order, itemKey, itemIds])

  const reorder = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return
    setState((prev) => {
      const order = reconcileOrder(prev.order, itemIds)
      const from = order.indexOf(fromId)
      const to = order.indexOf(toId)
      if (from < 0 || to < 0) return prev
      const next = order.slice()
      next.splice(from, 1)
      next.splice(to, 0, fromId)
      return { ...prev, order: next }
    })
  }, [itemIds])

  const setSize = useCallback((id: string, patch: LayoutSize) => {
    setState((prev) => ({
      ...prev,
      sizes: {
        ...prev.sizes,
        [id]: { ...prev.sizes[id], ...patch },
      },
    }))
  }, [])

  const getSize = useCallback((id: string): LayoutSize => state.sizes[id] || {}, [state.sizes])

  return { orderedIds, sizes: state.sizes, reorder, setSize, getSize }
}
