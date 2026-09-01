'use client'

import React from 'react'
import type { CanaryOnboarding } from '@/lib/canary/types'
import { MISSING_MUST_HAVE_LABEL, type MissingMustHave, type OnboardingPath } from '@/lib/canary/property-onboarding'

export type NeedsSetupItem = {
  unitId: string
  propertyId: string
  address: string
  path: OnboardingPath | null
  missing: MissingMustHave[]
  createdByName: string
  updatedAt: string
}

function pathLabel(path: OnboardingPath | null): string {
  if (path === 'vacant') return 'Vacant — listing'
  if (path === 'occupied') return 'Occupied — lease'
  return 'Path not chosen'
}

function relativeSaved(iso: string): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!t) return ''
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export default function NeedsSetupCard({
  items,
  onOpen,
}: {
  items: NeedsSetupItem[]
  onOpen: (unitId: string) => void
}) {
  if (!items.length) return null
  return (
    <div className="cy-home-panel cy-needs-setup">
      <div className="cy-home-panel-head">
        <div className="cy-home-panel-title-row">
          <div className="cy-home-panel-title">Needs setup</div>
          <span className="cy-home-panel-count">{items.length}</span>
        </div>
        <div className="cy-home-panel-sub">Unfinished properties — pick one up where you left off</div>
      </div>
      <div className="cy-needs-setup-list">
        {items.map((item) => (
          <button
            key={item.unitId}
            type="button"
            className="cy-needs-setup-row cy-hov"
            onClick={() => onOpen(item.unitId)}
          >
            <span className="cy-needs-setup-addr">{item.address.split(',')[0]}</span>
            <span className="cy-needs-setup-path">{pathLabel(item.path)}</span>
            <span className="cy-needs-setup-chips">
              {item.missing.map((m) => (
                <span key={m} className="cy-needs-setup-chip">
                  {MISSING_MUST_HAVE_LABEL[m]}
                </span>
              ))}
            </span>
            <span className="cy-needs-setup-meta">
              {[item.createdByName, relativeSaved(item.updatedAt)].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function onboardingByPropertyId(rows: CanaryOnboarding[]): Map<string, CanaryOnboarding> {
  return new Map(rows.map((row) => [row.propertyId, row]))
}
