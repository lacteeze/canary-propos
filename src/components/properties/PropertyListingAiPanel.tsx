'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import {
  getPropertyKnowledge,
  removeListingBriefOrgOption,
  savePropertyKnowledge,
  savePropertyListingBrief,
} from '@/app/actions/property-knowledge'
import {
  applyGeneratedListingCopy,
  generateListingDescription,
} from '@/app/actions/listing-ai'
import {
  DEFAULT_LISTING_BRIEF_OPTIONS,
  emptyListingBrief,
  isDefaultListingBriefOption,
  mergeListingBriefOptions,
  type ListingBrief,
  type ListingBriefField,
  type ListingBriefOptions,
  type ListingBriefScalarField,
} from '@/lib/listings/listing-brief'

const BRIEF_AUTOSAVE_MS = 500
const FEATURES_AUTOSAVE_MS = 150
const KB_AUTOSAVE_MS = 500

const SCALAR_FIELDS: {
  key: ListingBriefScalarField
  label: string
  placeholder: string
}[] = [
  { key: 'pets', label: 'Pets', placeholder: 'e.g. Cats OK with deposit' },
  { key: 'utilities', label: 'Utilities', placeholder: 'e.g. Heat included; tenant pays power' },
  { key: 'parking', label: 'Parking', placeholder: 'e.g. 1 driveway spot' },
  { key: 'laundry', label: 'Laundry', placeholder: 'e.g. In-unit washer/dryer' },
  { key: 'furnished', label: 'Furnished', placeholder: 'e.g. Unfurnished' },
  { key: 'neighborhood', label: 'Neighborhood', placeholder: 'Near downtown, quiet street…' },
]

const fieldStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '6px 8px',
  background: 'var(--elev)',
  color: 'var(--text)',
  width: '100%',
  fontSize: 12.5,
}

function BriefCombobox({
  fieldKey,
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  fieldKey: ListingBriefField
  label: string
  placeholder: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const listId = useId()
  const [customMode, setCustomMode] = useState(false)
  const known = options.some((o) => o.toLowerCase() === value.trim().toLowerCase())
  const showCustom = customMode || (!!value.trim() && !known)
  const selectValue = known && !customMode ? value : showCustom ? '__custom__' : ''

  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
      <span style={{ color: 'var(--dim)' }}>{label}</span>
      <select
        className="cy-select cy-select--field"
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value
          if (v === '__custom__') {
            setCustomMode(true)
            return
          }
          setCustomMode(false)
          onChange(v)
        }}
        aria-label={label}
      >
        <option value="">— Select —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="__custom__">Custom…</option>
      </select>
      {showCustom && (
        <input
          list={`${listId}-${fieldKey}`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setCustomMode(true)
            onChange(e.target.value)
          }}
          style={fieldStyle}
          aria-label={`${label} custom value`}
        />
      )}
      <datalist id={`${listId}-${fieldKey}`}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </label>
  )
}

function RemovableChip({
  label,
  onRemove,
  title,
}: {
  label: string
  onRemove: () => void
  title?: string
}) {
  return (
    <span
      className="cy-feature-chip"
      title={title}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 6,
        fontSize: 11.5,
        fontWeight: 600,
        background: 'var(--elev)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        maxWidth: '100%',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <button
        type="button"
        className="cy-feature-chip__remove"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        style={{
          appearance: 'none',
          border: 'none',
          background: 'transparent',
          color: 'var(--dim)',
          cursor: 'pointer',
          padding: 0,
          margin: 0,
          fontSize: 13,
          lineHeight: 1,
          width: 14,
          height: 14,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 120ms ease',
          flex: 'none',
        }}
      >
        ×
      </button>
    </span>
  )
}

function FeaturesMultiSelect({
  selected,
  options,
  onChange,
  onRemoveOrgOption,
  pending,
}: {
  selected: string[]
  options: string[]
  onChange: (next: string[]) => void
  onRemoveOrgOption: (value: string) => void
  pending: boolean
}) {
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('')

  const selectedLower = new Set(selected.map((s) => s.toLowerCase()))
  const available = options.filter((o) => !selectedLower.has(o.toLowerCase()))
  const learnedCustoms = options.filter((o) => !isDefaultListingBriefOption('features', o))

  function addFeature(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    if (selected.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return
    onChange([...selected, trimmed])
  }

  function removeFeature(value: string) {
    onChange(selected.filter((s) => s.toLowerCase() !== value.toLowerCase()))
  }

  return (
    <div style={{ display: 'grid', gap: 6, fontSize: 12, gridColumn: '1 / -1' }}>
      <style>{`
        .cy-feature-chip:hover .cy-feature-chip__remove,
        .cy-feature-chip:focus-within .cy-feature-chip__remove {
          opacity: 1 !important;
        }
        .cy-feature-chip__remove:hover {
          color: var(--red) !important;
        }
      `}</style>
      <span style={{ color: 'var(--dim)' }}>Standout features</span>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {selected.map((f) => (
            <RemovableChip key={f} label={f} onRemove={() => removeFeature(f)} title="Remove from this property" />
          ))}
        </div>
      )}
      <select
        className="cy-select cy-select--field"
        value=""
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value
          if (!v) return
          if (v === '__custom__') {
            setCustomMode(true)
            return
          }
          setCustomMode(false)
          setCustomValue('')
          addFeature(v)
        }}
        aria-label="Add standout feature"
      >
        <option value="">— Add feature —</option>
        {available.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="__custom__">Custom…</option>
      </select>
      {customMode && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={customValue}
            placeholder="e.g. Bay window, fenced yard…"
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addFeature(customValue)
                setCustomValue('')
                setCustomMode(false)
              }
            }}
            style={fieldStyle}
            aria-label="Custom standout feature"
          />
          <button
            type="button"
            className="cy-btn-ghost"
            disabled={pending || !customValue.trim()}
            onClick={() => {
              addFeature(customValue)
              setCustomValue('')
              setCustomMode(false)
            }}
          >
            Add
          </button>
        </div>
      )}
      {learnedCustoms.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--dim)' }}>
            Org custom options (hover × to remove from dropdown)
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {learnedCustoms.map((o) => (
              <RemovableChip
                key={`org-${o}`}
                label={o}
                title="Remove from org dropdown list"
                onRemove={() => onRemoveOrgOption(o)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const FIELD_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
}

export function PropertyListingAiPanel({
  propertyId,
  listingId,
  canEdit,
  leadingFields,
}: {
  propertyId: string
  listingId?: string | null
  canEdit: boolean
  /** Read-only overview cards rendered in the same grid as listing quick fields */
  leadingFields?: React.ReactNode
}) {
  const [brief, setBrief] = useState<ListingBrief>(() => emptyListingBrief())
  const [briefOptions, setBriefOptions] = useState<ListingBriefOptions>(() =>
    mergeListingBriefOptions({})
  )
  const [markdown, setMarkdown] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftHighlights, setDraftHighlights] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [briefSaveStatus, setBriefSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [briefReady, setBriefReady] = useState(false)
  const [pending, startTransition] = useTransition()
  const lastSavedBriefJson = useRef('')
  const briefAutosaveMs = useRef(BRIEF_AUTOSAVE_MS)
  const savedLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setBriefReady(false)
    setBriefSaveStatus('idle')
    ;(async () => {
      const data = await getPropertyKnowledge(propertyId)
      if (cancelled) return
      setBrief(data.listingBrief)
      lastSavedBriefJson.current = JSON.stringify(data.listingBrief)
      setBriefOptions(data.briefOptions ?? mergeListingBriefOptions({}))
      setMarkdown(data.markdown)
      setBriefReady(true)
    })()
    return () => {
      cancelled = true
      if (savedLabelTimer.current) clearTimeout(savedLabelTimer.current)
    }
  }, [propertyId])

  useEffect(() => {
    if (!canEdit || !briefReady) return
    const json = JSON.stringify(brief)
    if (json === lastSavedBriefJson.current) return

    let cancelled = false
    const delay = briefAutosaveMs.current
    const t = setTimeout(async () => {
      setBriefSaveStatus('saving')
      setErr('')
      const res = await savePropertyListingBrief(propertyId, brief)
      if (cancelled) return
      if (!res.success) {
        setBriefSaveStatus('error')
        setErr(res.error)
        return
      }
      lastSavedBriefJson.current = JSON.stringify(brief)
      if (res.briefOptions) setBriefOptions(res.briefOptions)
      setBriefSaveStatus('saved')
      if (savedLabelTimer.current) clearTimeout(savedLabelTimer.current)
      savedLabelTimer.current = setTimeout(() => {
        setBriefSaveStatus((s) => (s === 'saved' ? 'idle' : s))
      }, 2000)
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [brief, propertyId, canEdit, briefReady])

  function updateScalarField(key: ListingBriefScalarField, value: string) {
    briefAutosaveMs.current = BRIEF_AUTOSAVE_MS
    setBrief((b) => ({ ...b, [key]: value }))
  }

  function updateFeatures(features: string[]) {
    briefAutosaveMs.current = FEATURES_AUTOSAVE_MS
    setBrief((b) => ({ ...b, features }))
  }

  if (!canEdit) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        {leadingFields ? <div style={FIELD_GRID_STYLE}>{leadingFields}</div> : null}
        <div style={{ fontSize: 13, color: 'var(--dim)' }}>
          Listing inputs and knowledge base are manager-editable.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div
          style={{
            display: briefSaveStatus === 'idle' ? 'none' : 'flex',
            alignItems: 'baseline',
            justifyContent: 'flex-end',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span
            aria-live="polite"
            style={{
              fontSize: 11,
              color:
                briefSaveStatus === 'error'
                  ? 'var(--red)'
                  : briefSaveStatus === 'saved'
                    ? 'var(--green)'
                    : 'var(--dim)',
            }}
          >
            {briefSaveStatus === 'saving'
              ? 'Saving…'
              : briefSaveStatus === 'saved'
                ? 'Saved'
                : briefSaveStatus === 'error'
                  ? 'Save failed'
                  : ''}
          </span>
        </div>
        <div style={FIELD_GRID_STYLE}>
          {leadingFields}
          {SCALAR_FIELDS.map((f) => (
            <BriefCombobox
              key={f.key}
              fieldKey={f.key}
              label={f.label}
              placeholder={f.placeholder}
              value={brief[f.key]}
              options={briefOptions[f.key] ?? DEFAULT_LISTING_BRIEF_OPTIONS[f.key]}
              onChange={(v) => updateScalarField(f.key, v)}
            />
          ))}
          <FeaturesMultiSelect
            selected={brief.features}
            options={briefOptions.features ?? DEFAULT_LISTING_BRIEF_OPTIONS.features}
            pending={pending}
            onChange={updateFeatures}
            onRemoveOrgOption={(value) => {
              startTransition(async () => {
                setErr('')
                setMsg('')
                const res = await removeListingBriefOrgOption('features', value)
                if (!res.success) {
                  setErr(res.error)
                  return
                }
                if (res.briefOptions) setBriefOptions(res.briefOptions)
                setMsg('Removed custom option from org list.')
              })
            }}
          />
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Knowledge base (markdown)</div>
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          rows={8}
          placeholder="Systems, quirks, vendors, maintenance history, access notes…"
          style={{
            width: '100%',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 10,
            background: 'var(--elev)',
            color: 'var(--text)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12,
            resize: 'vertical',
          }}
        />
        <button
          type="button"
          className="cy-btn-ghost"
          disabled={pending}
          style={{ marginTop: 8 }}
          onClick={() => {
            startTransition(async () => {
              setErr('')
              setMsg('')
              const res = await savePropertyKnowledge(propertyId, markdown)
              if (!res.success) setErr(res.error)
              else setMsg('Knowledge base saved.')
            })
          }}
        >
          Save knowledge base
        </button>
      </div>

      <div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>AI listing description</div>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--dim)' }}>
          Uses quick fields, unit facts, and knowledge base via Vercel AI Gateway. Review before saving to a listing.
        </p>
        <button
          type="button"
          className="cy-btn-ghost"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              setErr('')
              setMsg('')
              const res = await generateListingDescription({
                propertyId,
                listingId: listingId || undefined,
              })
              if (!res.success) {
                setErr(res.error)
                return
              }
              setDraftTitle(res.title)
              setDraftDesc(res.description)
              setDraftHighlights(res.highlights.join(', '))
              setMsg('Draft ready — review and apply to listing if linked.')
            })
          }}
        >
          Generate description
        </button>
        {(draftTitle || draftDesc) && (
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              style={fieldStyle}
            />
            <textarea
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              rows={6}
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 10,
                background: 'var(--elev)',
                color: 'var(--text)',
              }}
            />
            <input
              value={draftHighlights}
              onChange={(e) => setDraftHighlights(e.target.value)}
              placeholder="Highlights (comma-separated)"
              style={fieldStyle}
            />
            {listingId ? (
              <button
                type="button"
                className="cy-btn-ghost"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await applyGeneratedListingCopy({
                      listingId,
                      title: draftTitle,
                      description: draftDesc,
                      highlights: draftHighlights
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                    if (!res.success) setErr(res.error)
                    else setMsg('Applied to listing draft.')
                  })
                }}
              >
                Apply to listing
              </button>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--dim)', margin: 0 }}>
                Open or create a website listing to apply this copy.
              </p>
            )}
          </div>
        )}
      </div>

      {msg ? <p style={{ margin: 0, fontSize: 12, color: 'var(--green)' }}>{msg}</p> : null}
      {err ? <p style={{ margin: 0, fontSize: 12, color: 'var(--red)' }}>{err}</p> : null}
    </div>
  )
}
