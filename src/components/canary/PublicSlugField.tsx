'use client'

import { useState, type MouseEvent } from 'react'
import { propertyPublicHref } from '@/lib/listings/listing-href'

type PublicSlugFieldProps = {
  slug: string | null | undefined
  disabled?: boolean
  onSave: (slug: string) => Promise<{ success: boolean; error?: string }>
}

/**
 * Editable public URL slug with canarypm.ca preview.
 * Managers can rename collision suffixes (e.g. …-2) when the base slug is free.
 */
export function PublicSlugField({ slug, disabled, onSave }: PublicSlugFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(slug ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  const href = propertyPublicHref({ slug }, { absolute: true })
  const previewPath = draft.trim()
    ? `canarypm.ca/${draft.trim().toLowerCase().replace(/[\s_]+/g, '-')}`
    : null

  if (disabled) {
    if (!href) return <span style={{ fontWeight: 600 }}>—</span>
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: 'var(--blue, #2563eb)',
          fontSize: 12.5,
          fontWeight: 600,
          textDecoration: 'none',
          wordBreak: 'break-all',
        }}
      >
        {href.replace(/^https?:\/\//, '')}
      </a>
    )
  }

  const enterEdit = () => {
    setDraft(slug ?? '')
    setEditing(true)
    setErr('')
  }

  const save = async () => {
    setSaving(true)
    setErr('')
    const res = await onSave(draft)
    setSaving(false)
    if (res.success) setEditing(false)
    else setErr(res.error ?? 'Failed')
  }

  const copy = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!href) return
    try {
      await navigator.clipboard.writeText(href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('Copy public link:', href)
    }
  }

  if (!editing) {
    return (
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="cy-inline-field"
            onClick={enterEdit}
            aria-label="Edit public URL slug"
            style={{ wordBreak: 'break-all', textAlign: 'left' }}
          >
            {href ? href.replace(/^https?:\/\//, '') : 'Set public URL…'}
          </button>
          {href && (
            <button
              type="button"
              onClick={copy}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--input)',
                color: 'var(--text)',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                flex: 'none',
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </span>
        {slug?.match(/-\d+$/) && (
          <span style={{ color: 'var(--dim)', fontSize: 11, lineHeight: 1.35 }}>
            A trailing -2 (or -3…) means another address already used the same slug. Edit to rename if free.
          </span>
        )}
      </span>
    )
  }

  return (
    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
          if (e.key === 'Escape') setEditing(false)
        }}
        placeholder="151-a-signal-hill-rd"
        autoFocus
        disabled={saving}
        style={{
          width: '100%',
          background: 'var(--input)',
          border: '1px solid var(--border)',
          borderRadius: 7,
          padding: '6px 10px',
          fontWeight: 600,
          fontSize: 13,
          fontFamily: 'inherit',
        }}
      />
      {previewPath && (
        <span style={{ color: 'var(--dim)', fontSize: 11, wordBreak: 'break-all' }}>
          Preview: {previewPath}
        </span>
      )}
      <span style={{ color: 'var(--dim)', fontSize: 11, lineHeight: 1.35 }}>
        Lowercase letters, numbers, and hyphens. Published listing URLs on this property stay in sync.
      </span>
      <span style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          style={{
            border: 'none',
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            borderRadius: 6,
            padding: '4px 12px',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          style={{
            border: '1px solid var(--border)',
            background: 'var(--elev)',
            borderRadius: 6,
            padding: '4px 12px',
            fontSize: 12,
            cursor: 'pointer',
            color: 'var(--dim)',
          }}
        >
          Cancel
        </button>
      </span>
      {err && <span style={{ color: 'var(--red)', fontSize: 11 }}>{err}</span>}
    </span>
  )
}
