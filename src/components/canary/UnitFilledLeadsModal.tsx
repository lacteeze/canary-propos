'use client'

import React, { useMemo, useState } from 'react'
import {
  closeInquiriesAsLost,
  convertInquiriesToInterestPool,
} from '@/app/actions/inquiries'
import {
  INQUIRY_PIPELINE_LABELS,
  type CanaryInquiry,
} from '@/lib/canary/types'
import { MatchingHomesPanel } from './MatchingHomesPanel'

type Props = {
  /** The inquiry that just moved to Signed (context only). */
  signedInquiry: CanaryInquiry
  leftovers: CanaryInquiry[]
  onDismiss: () => void
  onApplied: (updated: CanaryInquiry[]) => void
}

export function UnitFilledLeadsModal({
  signedInquiry,
  leftovers,
  onDismiss,
  onApplied,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(leftovers.map((l) => l.id)),
  )
  const [busy, setBusy] = useState<'convert' | 'close' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [matchFocusId, setMatchFocusId] = useState<string | null>(
    leftovers[0]?.id ?? null,
  )

  const selectedList = useMemo(
    () => leftovers.filter((l) => selected.has(l.id)),
    [leftovers, selected],
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(leftovers.map((l) => l.id)))
  }

  async function runConvert() {
    if (!selectedList.length) return
    setBusy('convert')
    setError(null)
    const result = await convertInquiriesToInterestPool(selectedList.map((l) => l.id))
    setBusy(null)
    if (result.error) {
      setError(result.error)
      return
    }
    const updated = selectedList.map((l) => ({
      ...l,
      listingId: null,
      status: (l.status === 'new' ? 'new' : 'contacted') as CanaryInquiry['status'],
      isGeneralInterest: true,
      property: l.property.startsWith('General') ? l.property : l.property,
      note: l.note.trimStart().startsWith('[General interest]')
        ? l.note
        : `[General interest]\nConverted from: ${signedInquiry.property}\n\n${l.note}`.trim(),
      latestNote: {
        id: crypto.randomUUID(),
        body: `Converted to interest pool from ${signedInquiry.property} because unit leased.`,
        createdAt: new Date().toISOString(),
        authorName: 'You',
      },
    }))
    onApplied(updated)
  }

  async function runClose() {
    if (!selectedList.length) return
    setBusy('close')
    setError(null)
    const result = await closeInquiriesAsLost(selectedList.map((l) => l.id))
    setBusy(null)
    if (result.error) {
      setError(result.error)
      return
    }
    const updated = selectedList.map((l) => ({
      ...l,
      status: 'closed' as const,
    }))
    onApplied(updated)
  }

  return (
    <>
      <div
        className="cy-modal-backdrop cy-glass-modal-backdrop"
        style={{ zIndex: 90 }}
        onClick={onDismiss}
        aria-hidden
      />
      <div
        className="cy-glass-modal cy-unit-filled-modal"
        style={{ zIndex: 91 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cy-unit-filled-title"
      >
        <div className="cy-unit-filled-head">
          <div>
            <div className="cy-eyebrow" style={{ marginBottom: 4 }}>
              Unit filled
            </div>
            <h3 id="cy-unit-filled-title" className="cy-unit-filled-title">
              Recycle leftover prospects?
            </h3>
            <p className="cy-unit-filled-sub">
              <strong>{signedInquiry.name}</strong> signed at{' '}
              <strong>{signedInquiry.property}</strong>.{' '}
              {leftovers.length} other open prospect
              {leftovers.length === 1 ? '' : 's'} on this home — convert to the
              interest pool, close as lost, or leave as-is.
            </p>
          </div>
          <button type="button" className="cy-btn" onClick={onDismiss}>
            ✕
          </button>
        </div>

        {error && (
          <div className="cy-pipeline-error" role="alert">
            {error}
          </div>
        )}

        <div className="cy-unit-filled-toolbar">
          <button type="button" className="cy-btn" onClick={selectAll}>
            Select all
          </button>
          <button
            type="button"
            className="cy-btn"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
          <span className="cy-unit-filled-count">
            {selected.size} selected
          </span>
        </div>

        <ul className="cy-unit-filled-list">
          {leftovers.map((l) => (
            <li key={l.id}>
              <label className="cy-unit-filled-row">
                <input
                  type="checkbox"
                  checked={selected.has(l.id)}
                  onChange={() => toggle(l.id)}
                />
                <button
                  type="button"
                  className="cy-unit-filled-row-main"
                  onClick={() => setMatchFocusId(l.id)}
                >
                  <span className="cy-pipeline-card-name">{l.name}</span>
                  <span className="cy-unit-filled-contact">
                    {l.email}
                    {l.phone ? ` · ${l.phone}` : ''}
                  </span>
                  <span className="cy-unit-filled-stage">
                    {INQUIRY_PIPELINE_LABELS[l.status]}
                  </span>
                </button>
              </label>
            </li>
          ))}
        </ul>

        {matchFocusId ? (
          <MatchingHomesPanel
            inquiryId={matchFocusId}
            allowAssign
            compact
            onAssigned={() => {
              // Treat as applied with no local patch — parent refreshes from server.
              onApplied([])
            }}
          />
        ) : null}

        <div className="cy-unit-filled-foot">
          <button
            type="button"
            className="cy-btn"
            style={{ color: 'var(--dim)' }}
            onClick={onDismiss}
            disabled={busy != null}
          >
            Leave as-is
          </button>
          <button
            type="button"
            className="cy-btn"
            onClick={() => void runClose()}
            disabled={!selected.size || busy != null}
          >
            {busy === 'close' ? 'Closing…' : 'Close selected as lost'}
          </button>
          <button
            type="button"
            className="cy-btn cy-btn-primary"
            onClick={() => void runConvert()}
            disabled={!selected.size || busy != null}
          >
            {busy === 'convert' ? 'Converting…' : 'Convert to interest pool'}
          </button>
        </div>
      </div>
    </>
  )
}
