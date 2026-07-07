'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { getAuditLog, type AuditEntry } from '@/app/actions/entity-updates'

const MONO = "'IBM Plex Mono', monospace"

interface AuditLogPanelProps {
  tableName: string
  recordId: string
  canEdit: boolean
}

export default function AuditLogPanel({ tableName, recordId, canEdit }: AuditLogPanelProps) {
  const [minimized, setMinimized] = useState(true)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!canEdit) return
    setLoading(true)
    try {
      const data = await getAuditLog(tableName, recordId)
      setEntries(data)
    } finally {
      setLoading(false)
    }
  }, [tableName, recordId, canEdit])

  useEffect(() => {
    if (!minimized && canEdit) load()
  }, [minimized, load, canEdit])

  if (!canEdit) return null

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <button
        type="button"
        onClick={() => setMinimized((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          color: 'var(--dim)',
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 11 }}>{minimized ? '▸' : '▾'}</span>
        <span style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          Audit log {entries.length ? `(${entries.length})` : ''}
        </span>
      </button>
      {!minimized && (
        <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
          {loading && <div style={{ color: 'var(--faint)', fontSize: 12, padding: 8 }}>Loading…</div>}
          {!loading && !entries.length && (
            <div style={{ color: 'var(--faint)', fontSize: 12, padding: 8 }}>No changes recorded yet.</div>
          )}
          {entries.map((e) => (
            <div
              key={e.id}
              style={{
                padding: '8px 4px',
                borderBottom: '1px solid var(--border)',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{e.fieldName}</span>
                <span style={{ color: 'var(--faint)', fontFamily: MONO, fontSize: 10, whiteSpace: 'nowrap' }}>
                  {new Date(e.changedAt).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ color: 'var(--dim)' }}>
                <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{e.oldValue ?? '—'}</span>
                {' → '}
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{e.newValue ?? '—'}</span>
              </div>
              <div style={{ color: 'var(--faint)', fontSize: 11, marginTop: 2 }}>by {e.changedByName}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}