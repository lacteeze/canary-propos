export type LayoutSize = {
  /** Column span on the 12-column grid (1–12). */
  colSpan?: number
  /** Minimum card height in px. */
  minHeight?: number
}

export type ViewLayoutState = {
  order: string[]
  sizes: Record<string, LayoutSize>
}

export type LayoutGridPreset = {
  defaultColSpan: number
  minColSpan: number
  maxColSpan: number
  defaultMinHeight?: number
  minMinHeight: number
  maxMinHeight: number
  /** Soft-disable resize below this width (px). */
  resizeMinViewport?: number
}

export const KPI_LAYOUT_PRESET: LayoutGridPreset = {
  defaultColSpan: 2,
  minColSpan: 1,
  maxColSpan: 4,
  minMinHeight: 64,
  maxMinHeight: 160,
  resizeMinViewport: 700,
}

export const SECTION_LAYOUT_PRESET: LayoutGridPreset = {
  defaultColSpan: 6,
  minColSpan: 3,
  maxColSpan: 12,
  defaultMinHeight: 180,
  minMinHeight: 120,
  maxMinHeight: 560,
  resizeMinViewport: 700,
}

export const CARD_LAYOUT_PRESET: LayoutGridPreset = {
  defaultColSpan: 4,
  minColSpan: 3,
  maxColSpan: 12,
  defaultMinHeight: 110,
  minMinHeight: 88,
  maxMinHeight: 320,
  resizeMinViewport: 700,
}

export type ResizeEdge =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw'

export const LONG_PRESS_MS = 400
export const MOVE_CANCEL_PX = 8
export const EDGE_ZONE_PX = 10
