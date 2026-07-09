'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  EDGE_ZONE_PX,
  LONG_PRESS_MS,
  MOVE_CANCEL_PX,
  type LayoutGridPreset,
  type LayoutSize,
  type ResizeEdge,
} from './types'

type CursorMode = 'default' | 'grab' | 'grabbing' | ResizeEdge

function cursorFor(mode: CursorMode): string | undefined {
  switch (mode) {
    case 'grab':
      return 'grab'
    case 'grabbing':
      return 'grabbing'
    case 'e':
    case 'w':
      return 'ew-resize'
    case 'n':
    case 's':
      return 'ns-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
    case 'nw':
    case 'se':
      return 'nwse-resize'
    default:
      return undefined
  }
}

function hitTestEdge(x: number, y: number, w: number, h: number, zone: number): ResizeEdge | null {
  const nearL = x <= zone
  const nearR = x >= w - zone
  const nearT = y <= zone
  const nearB = y >= h - zone
  if (nearT && nearL) return 'nw'
  if (nearT && nearR) return 'ne'
  if (nearB && nearL) return 'sw'
  if (nearB && nearR) return 'se'
  if (nearL) return 'w'
  if (nearR) return 'e'
  if (nearT) return 'n'
  if (nearB) return 's'
  return null
}

export type LayoutCardProps = {
  id: string
  className?: string
  style?: React.CSSProperties
  preset: LayoutGridPreset
  size: LayoutSize
  columns: number
  gapPx: number
  /** Called when size changes (colSpan / minHeight). */
  onSizeChange: (id: string, size: LayoutSize) => void
  /** Long-press drag started. */
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDragEnd: () => void
  dragging: boolean
  dragActiveId: string | null
  /** Optional click when not drag/resize. */
  onActivate?: () => void
  role?: React.AriaRole
  tabIndex?: number
  children: React.ReactNode
}

export default function LayoutCard({
  id,
  className,
  style,
  preset,
  size,
  columns,
  gapPx,
  onSizeChange,
  onDragStart,
  onDragOver,
  onDragEnd,
  dragging,
  dragActiveId,
  onActivate,
  role,
  tabIndex,
  children,
}: LayoutCardProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [hoverCursor, setHoverCursor] = useState<CursorMode>('default')
  const [resizing, setResizing] = useState(false)
  const suppressClick = useRef(false)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressOrigin = useRef<{ x: number; y: number } | null>(null)
  const dragEngaged = useRef(false)
  const resizeSession = useRef<{
    edge: ResizeEdge
    startX: number
    startY: number
    startColSpan: number
    startMinHeight: number
    cellWidth: number
  } | null>(null)

  const colSpan = Math.min(
    preset.maxColSpan,
    Math.max(preset.minColSpan, size.colSpan ?? preset.defaultColSpan)
  )
  const minHeight = size.minHeight ?? preset.defaultMinHeight
  const resizeEnabled =
    typeof window === 'undefined' ||
    window.innerWidth >= (preset.resizeMinViewport ?? 0)

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const updateHoverCursor = useCallback(
    (clientX: number, clientY: number) => {
      if (dragging || resizing) return
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      if (resizeEnabled) {
        const edge = hitTestEdge(x, y, rect.width, rect.height, EDGE_ZONE_PX)
        if (edge) {
          setHoverCursor(edge)
          return
        }
      }
      setHoverCursor('grab')
    },
    [dragging, resizing, resizeEnabled]
  )

  const beginResize = useCallback(
    (edge: ResizeEdge, clientX: number, clientY: number) => {
      const el = rootRef.current
      if (!el) return
      const parent = el.parentElement
      if (!parent) return
      const parentW = parent.getBoundingClientRect().width
      const cellWidth = (parentW - gapPx * (columns - 1)) / columns
      resizeSession.current = {
        edge,
        startX: clientX,
        startY: clientY,
        startColSpan: colSpan,
        startMinHeight: minHeight ?? el.getBoundingClientRect().height,
        cellWidth,
      }
      setResizing(true)
      suppressClick.current = true
      setHoverCursor(edge)
    },
    [colSpan, minHeight, gapPx, columns]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      // Don't steal from interactive children (buttons, links, inputs)
      const target = e.target as HTMLElement
      if (target.closest('button, a, input, select, textarea, [data-no-layout-dnd]')) return

      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (resizeEnabled) {
        const edge = hitTestEdge(x, y, rect.width, rect.height, EDGE_ZONE_PX)
        if (edge) {
          e.preventDefault()
          el.setPointerCapture(e.pointerId)
          beginResize(edge, e.clientX, e.clientY)
          return
        }
      }

      pressOrigin.current = { x: e.clientX, y: e.clientY }
      dragEngaged.current = false
      clearLongPress()
      longPressTimer.current = setTimeout(() => {
        dragEngaged.current = true
        suppressClick.current = true
        onDragStart(id)
        setHoverCursor('grabbing')
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          /* already released */
        }
      }, LONG_PRESS_MS)
    },
    [resizeEnabled, beginResize, clearLongPress, onDragStart, id]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (resizeSession.current) {
        const s = resizeSession.current
        const dx = e.clientX - s.startX
        const dy = e.clientY - s.startY
        let nextCol = s.startColSpan
        let nextH = s.startMinHeight

        const colDelta = Math.round(dx / Math.max(1, s.cellWidth + gapPx))
        if (s.edge.includes('e')) nextCol = s.startColSpan + colDelta
        if (s.edge.includes('w')) nextCol = s.startColSpan - colDelta
        nextCol = Math.min(preset.maxColSpan, Math.max(preset.minColSpan, nextCol))

        if (s.edge.includes('s')) nextH = s.startMinHeight + dy
        if (s.edge.includes('n')) nextH = s.startMinHeight - dy
        nextH = Math.min(preset.maxMinHeight, Math.max(preset.minMinHeight, nextH))

        onSizeChange(id, {
          colSpan: nextCol,
          minHeight: Math.round(nextH),
        })
        return
      }

      if (pressOrigin.current && !dragEngaged.current) {
        const dx = e.clientX - pressOrigin.current.x
        const dy = e.clientY - pressOrigin.current.y
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          clearLongPress()
          pressOrigin.current = null
        }
      }

      if (dragEngaged.current || dragActiveId === id) {
        setHoverCursor('grabbing')
        return
      }

      updateHoverCursor(e.clientX, e.clientY)
    },
    [
      gapPx,
      preset.maxColSpan,
      preset.minColSpan,
      preset.maxMinHeight,
      preset.minMinHeight,
      onSizeChange,
      id,
      clearLongPress,
      dragActiveId,
      updateHoverCursor,
    ]
  )

  const endInteraction = useCallback(
    (e: React.PointerEvent) => {
      clearLongPress()
      if (resizeSession.current) {
        resizeSession.current = null
        setResizing(false)
        try {
          rootRef.current?.releasePointerCapture(e.pointerId)
        } catch {
          /* noop */
        }
        // Keep suppressClick until after click event
        window.setTimeout(() => {
          suppressClick.current = false
        }, 0)
        return
      }

      if (dragEngaged.current || dragActiveId === id) {
        dragEngaged.current = false
        onDragEnd()
        try {
          rootRef.current?.releasePointerCapture(e.pointerId)
        } catch {
          /* noop */
        }
        window.setTimeout(() => {
          suppressClick.current = false
        }, 0)
      }

      pressOrigin.current = null
      setHoverCursor('default')
    },
    [clearLongPress, dragActiveId, id, onDragEnd]
  )

  const onClickCapture = useCallback(
    (e: React.MouseEvent) => {
      if (suppressClick.current || dragging || resizing) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    [dragging, resizing]
  )

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (suppressClick.current || dragging || resizing) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      // Nested interactive rows handle their own clicks
      const t = e.target as HTMLElement
      if (t.closest('button, a, input, select, textarea, [data-no-layout-dnd]')) return
      onActivate?.()
    },
    [dragging, resizing, onActivate]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!onActivate) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onActivate()
      }
    },
    [onActivate]
  )

  useEffect(() => () => clearLongPress(), [clearLongPress])

  const isDragging = dragging || dragActiveId === id
  const resolvedCursor = cursorFor(isDragging ? 'grabbing' : resizing ? hoverCursor : hoverCursor)

  return (
    <div
      ref={rootRef}
      data-layout-id={id}
      className={`cy-layout-card${className ? ` ${className}` : ''}${isDragging ? ' cy-layout-card--dragging' : ''}${resizing ? ' cy-layout-card--resizing' : ''}`}
      role={role}
      tabIndex={tabIndex}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
      onPointerEnter={(e) => updateHoverCursor(e.clientX, e.clientY)}
      onPointerLeave={() => {
        if (!dragging && !resizing) setHoverCursor('default')
      }}
      onClickCapture={onClickCapture}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={{
        ...style,
        gridColumn: `span ${colSpan}`,
        minHeight: minHeight != null ? minHeight : undefined,
        cursor: resolvedCursor,
        touchAction: isDragging || resizing ? 'none' : 'manipulation',
        userSelect: isDragging || resizing ? 'none' : undefined,
      }}
    >
      {children}
    </div>
  )
}
