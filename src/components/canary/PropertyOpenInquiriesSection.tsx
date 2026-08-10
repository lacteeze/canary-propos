'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { convertInquiriesToInterestPool } from '@/app/actions/inquiries'
import {
  INQUIRY_PIPELINE_LABELS,
  isOpenInquiryStatus,
  type CanaryInquiry,
  type CanaryProperty,
} from '@/lib/canary/types'

/** Open, property-linked leads that are not yet in the interest pool (excludes signed/closed). */
export function openInquiriesForProperty(
  inquiries: CanaryInquiry[],
  property: Pick<CanaryProperty, 'propertyDbId' | 'address'>,
): CanaryInquiry[] {
  return inquiries.filter((i) => {
    if (!isOpenInquiryStatus(i.status)) return false
    if (i.isGeneralInterest) return false
    if (property.propertyDbId && i.propertyId) {
      return i.propertyId === property.propertyDbId
    }
    return Boolean(property.address) && i.property === property.address
  })
}

function isLeasedOrOccupied(status: string | null | undefined): boolean {
  const s = (status || '').trim().toLowerCase()
  return s === 'leased' || s === 'occupied'
}

type Props = {
  property: CanaryProperty
  inquiries: CanaryInquiry[]
  canEdit: boolean
  onConverted: () => void
}

export function PropertyOpenInquiriesSection({
  property,
  inquiries,
  canEdit,
  onConverted,
}: Props) {
  const source = useMemo(
    () => openInquiriesForProperty(inquiries, property),
    [inquiries, property],
  )
  const [items, setItems] = useState(source)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(source.map((i) => i.id)))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setItems(source)
    setSelected(new Set(source.map((i) => i.id)))
  }, [source])

  if (!items.length) return null

  const selectedList = items.filter((i) => selected.has(i.id))
  const showBanner = isLeasedOrOccupied(property.status)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runConvert(ids: string[]) {
    if (!ids.length || busy) return
    setBusy(true)
    const result = await convertInquiriesToInterestPool(ids)
    setBusy(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    const converted = result.updated ?? ids.length
    setItems((list) => list.filter((i) => !ids.includes(i.id)))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
    toast.success(
      converted === 1
        ? 'Converted 1 lead to the interest pool'
        : `Converted ${converted} leads to the interest pool`,
    )
    onConverted()
  }

  return (
    <div className="cy-prop-inquiries">
      {showBanner ? (
        <div className="cy-prop-inquiries-banner" role="status">
          <span>
            {items.length} open inquir{items.length === 1 ? 'y' : 'ies'} — convert to interest pool
          </span>
          {canEdit ? (
            <button
              type="button"
              className="cy-btn cy-btn-primary"
              disabled={busy}
              onClick={() => void runConvert(items.map((i) => i.id))}
            >
              {busy ? 'Converting…' : 'Convert all to interest pool'}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="cy-drawer-section-title">
        Open inquiries ({items.length})
      </div>
      <p className="cy-prop-inquiries-help">
        Leftover leads for this home. Convert moves them to the general interest pool in-app
        (no emails).
      </p>

      <div className="cy-prop-inquiries-toolbar">
        <button
          type="button"
          className="cy-btn"
          onClick={() => setSelected(new Set(items.map((i) => i.id)))}
          disabled={busy}
        >
          Select all
        </button>
        <button
          type="button"
          className="cy-btn"
          onClick={() => setSelected(new Set())}
          disabled={busy}
        >
          Clear
        </button>
        <span className="cy-prop-inquiries-count">{selected.size} selected</span>
      </div>

      <ul className="cy-prop-inquiries-list">
        {items.map((i) => (
          <li key={i.id}>
            <label className="cy-prop-inquiries-row">
              <input
                type="checkbox"
                checked={selected.has(i.id)}
                onChange={() => toggle(i.id)}
                disabled={busy || !canEdit}
              />
              <span className="cy-prop-inquiries-row-main">
                <span className="cy-pipeline-card-name">{i.name}</span>
                <span className="cy-prop-inquiries-contact">
                  {i.email}
                  {i.phone ? ` · ${i.phone}` : ''}
                </span>
                <span className="cy-prop-inquiries-stage">
                  {INQUIRY_PIPELINE_LABELS[i.status]}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {canEdit ? (
        <div className="cy-prop-inquiries-foot">
          <button
            type="button"
            className="cy-btn"
            disabled={!selectedList.length || busy}
            onClick={() => void runConvert(selectedList.map((i) => i.id))}
          >
            {busy ? 'Converting…' : 'Convert selected'}
          </button>
          <button
            type="button"
            className="cy-btn cy-btn-primary"
            disabled={busy}
            onClick={() => void runConvert(items.map((i) => i.id))}
          >
            {busy ? 'Converting…' : 'Convert all to interest pool'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
