'use client'

import React, { useCallback, useRef, useState } from 'react'
import LayoutCard, { type LayoutCardProps } from './LayoutCard'
import type { LayoutGridPreset, LayoutSize } from './types'

export type LayoutGridItem = {
  id: string
  className?: string
  style?: React.CSSProperties
  onActivate?: () => void
  role?: React.AriaRole
  tabIndex?: number
  children: React.ReactNode
}

type LayoutGridProps = {
  className?: string
  style?: React.CSSProperties
  preset: LayoutGridPreset
  orderedIds: string[]
  sizes: Record<string, LayoutSize>
  onReorder: (fromId: string, toId: string) => void
  onSizeChange: (id: string, size: LayoutSize) => void
  /** CSS grid columns count (default 12). */
  columns?: number
  gapPx?: number
  items: LayoutGridItem[]
}

export default function LayoutGrid({
  className,
  style,
  preset,
  orderedIds,
  sizes,
  onReorder,
  onSizeChange,
  columns = 12,
  gapPx = 10,
  items,
}: LayoutGridProps) {
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)
  const lastOver = useRef<string | null>(null)

  const byId = new Map(items.map((it) => [it.id, it]))
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as LayoutGridItem[]

  const handleDragStart = useCallback((id: string) => {
    setDragActiveId(id)
    lastOver.current = id
  }, [])

  const handleDragOver = useCallback(
    (id: string) => {
      if (!dragActiveId || id === dragActiveId) return
      if (lastOver.current === id) return
      lastOver.current = id
      onReorder(dragActiveId, id)
    },
    [dragActiveId, onReorder]
  )

  const handleDragEnd = useCallback(() => {
    setDragActiveId(null)
    lastOver.current = null
  }, [])

  // While dragging, detect which card is under the pointer via document events
  React.useEffect(() => {
    if (!dragActiveId) return
    const onMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const card = el?.closest?.('[data-layout-id]') as HTMLElement | null
      const overId = card?.getAttribute('data-layout-id')
      if (overId) handleDragOver(overId)
    }
    const onUp = () => handleDragEnd()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragActiveId, handleDragOver, handleDragEnd])

  return (
    <div
      className={`cy-layout-grid${className ? ` ${className}` : ''}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: gapPx,
        ...style,
      }}
    >
      {ordered.map((item) => {
        const cardProps: Omit<LayoutCardProps, 'children'> = {
          id: item.id,
          className: item.className,
          style: item.style,
          preset,
          size: sizes[item.id] || {},
          columns,
          gapPx,
          onSizeChange,
          onDragStart: handleDragStart,
          onDragOver: handleDragOver,
          onDragEnd: handleDragEnd,
          dragging: dragActiveId === item.id,
          dragActiveId,
          onActivate: item.onActivate,
          role: item.role,
          tabIndex: item.tabIndex,
        }
        return (
          <LayoutCard key={item.id} {...cardProps}>
            {item.children}
          </LayoutCard>
        )
      })}
    </div>
  )
}
