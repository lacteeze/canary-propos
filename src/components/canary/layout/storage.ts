import type { LayoutSize, ViewLayoutState } from './types'

function storageKey(viewKey: string, userKey?: string | null): string {
  const user = (userKey || 'anon').trim() || 'anon'
  return `canary_layout_${viewKey}_${user}`
}

function isValidSize(v: unknown): v is LayoutSize {
  if (!v || typeof v !== 'object') return false
  const s = v as LayoutSize
  if (s.colSpan != null && (typeof s.colSpan !== 'number' || !Number.isFinite(s.colSpan))) return false
  if (s.minHeight != null && (typeof s.minHeight !== 'number' || !Number.isFinite(s.minHeight))) return false
  return true
}

export function loadViewLayout(viewKey: string, userKey?: string | null): ViewLayoutState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(viewKey, userKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ViewLayoutState>
    const order = Array.isArray(parsed.order) ? parsed.order.filter((id): id is string => typeof id === 'string') : []
    const sizes: Record<string, LayoutSize> = {}
    if (parsed.sizes && typeof parsed.sizes === 'object') {
      for (const [id, size] of Object.entries(parsed.sizes)) {
        if (isValidSize(size)) sizes[id] = size
      }
    }
    return { order, sizes }
  } catch {
    return null
  }
}

export function saveViewLayout(viewKey: string, state: ViewLayoutState, userKey?: string | null): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(viewKey, userKey), JSON.stringify(state))
  } catch {
    // Quota / private mode — ignore
  }
}

/** Merge saved order with current item ids (drop missing, append new). */
export function reconcileOrder(saved: string[] | undefined, itemIds: string[]): string[] {
  const known = new Set(itemIds)
  const next: string[] = []
  for (const id of saved || []) {
    if (known.has(id) && !next.includes(id)) next.push(id)
  }
  for (const id of itemIds) {
    if (!next.includes(id)) next.push(id)
  }
  return next
}
