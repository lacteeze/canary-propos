'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Building2, FileText, Home, Plus, Upload, Wallet } from 'lucide-react'
import type { ImportDataset } from '@/lib/canary/import-specs'

export type FabAction = 'property' | 'lease' | 'listing' | 'expense' | 'import'

const ACTION_META: Record<FabAction, { label: string; icon: React.ReactNode; description: string }> = {
  property: { label: 'Property', icon: <Home size={18} />, description: 'Add a new property' },
  lease: { label: 'Lease', icon: <FileText size={18} />, description: 'Draft a new lease' },
  listing: { label: 'Listing', icon: <Building2 size={18} />, description: 'Publish a public listing' },
  expense: { label: 'Expense', icon: <Wallet size={18} />, description: 'Record a payment or expense' },
  import: { label: 'Import Data', icon: <Upload size={18} />, description: 'Bulk import from CSV' },
}

const VIEW_IMPORT_DATASET: Partial<Record<string, ImportDataset>> = {
  properties: 'properties',
  leases: 'leases',
  people: 'people',
  portfolios: 'portfolios',
  payments: 'payments',
  projects: 'projects',
}

/** All FAB actions for privileged users — import dataset is scoped separately by view. */
export function fabActionsForView(_view: string, priv: boolean): FabAction[] {
  if (!priv) return []
  return ['property', 'lease', 'listing', 'expense', 'import']
}

export function importDatasetForView(view: string): ImportDataset | undefined {
  return VIEW_IMPORT_DATASET[view]
}

interface CanaryActionFabProps {
  view: string
  priv: boolean
  onAction: (action: FabAction) => void
}

export default function CanaryActionFab({ view, priv, onAction }: CanaryActionFabProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const actions = fabActionsForView(view, priv)
  if (!actions.length) return null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const importHint = importDatasetForView(view)

  return (
    <div ref={wrapRef} className="cy-fab-wrap" role="group" aria-label="Quick actions">
      {open && (
        <div className="cy-fab-menu" role="menu">
          {actions.map((action) => {
            const meta = ACTION_META[action]
            const hint = action === 'import' && importHint
              ? `Import ${importHint} CSV`
              : meta.description
            return (
              <button
                key={action}
                type="button"
                role="menuitem"
                className="cy-fab-action"
                onClick={() => { setOpen(false); onAction(action) }}
              >
                <span className="cy-fab-action-label">
                  <span className="cy-fab-action-title">{meta.label}</span>
                  <span className="cy-fab-action-desc">{hint}</span>
                </span>
                <span className="cy-fab-action-icon" aria-hidden="true">{meta.icon}</span>
              </button>
            )
          })}
        </div>
      )}
      <button
        type="button"
        className={`cy-fab-btn${open ? ' cy-fab-btn--open' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? 'Close quick actions' : 'Open quick actions'}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={24} strokeWidth={2.2} className="cy-fab-plus" />
      </button>
    </div>
  )
}
