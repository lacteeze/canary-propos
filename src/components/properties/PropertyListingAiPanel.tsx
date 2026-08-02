'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  getPropertyKnowledge,
  savePropertyKnowledge,
  savePropertyListingBrief,
} from '@/app/actions/property-knowledge'
import {
  applyGeneratedListingCopy,
  generateListingDescription,
} from '@/app/actions/listing-ai'
import type { ListingBrief } from '@/lib/listings/listing-brief'

const BRIEF_FIELDS: { key: keyof ListingBrief; label: string; placeholder: string }[] = [
  { key: 'pets', label: 'Pets', placeholder: 'e.g. Cats OK with deposit' },
  { key: 'utilities', label: 'Utilities', placeholder: 'e.g. Heat included; tenant pays power' },
  { key: 'parking', label: 'Parking', placeholder: 'e.g. 1 driveway spot' },
  { key: 'laundry', label: 'Laundry', placeholder: 'e.g. In-unit washer/dryer' },
  { key: 'furnished', label: 'Furnished', placeholder: 'e.g. Unfurnished' },
  { key: 'neighborhood', label: 'Neighborhood', placeholder: 'Near downtown, quiet street…' },
  { key: 'features', label: 'Standout features', placeholder: 'Hardwood, south-facing…' },
  { key: 'targetTenant', label: 'Target tenant', placeholder: 'Professionals, small family…' },
]

export function PropertyListingAiPanel({
  propertyId,
  listingId,
  canEdit,
}: {
  propertyId: string
  listingId?: string | null
  canEdit: boolean
}) {
  const [brief, setBrief] = useState<ListingBrief>({
    pets: '',
    utilities: '',
    parking: '',
    laundry: '',
    furnished: '',
    neighborhood: '',
    features: '',
    targetTenant: '',
  })
  const [markdown, setMarkdown] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftHighlights, setDraftHighlights] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await getPropertyKnowledge(propertyId)
      if (cancelled) return
      setBrief(data.listingBrief)
      setMarkdown(data.markdown)
    })()
    return () => {
      cancelled = true
    }
  }, [propertyId])

  if (!canEdit) {
    return (
      <div style={{ fontSize: 13, color: 'var(--dim)' }}>
        Listing inputs and knowledge base are manager-editable.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Listing quick fields</div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
          {BRIEF_FIELDS.map((f) => (
            <label key={f.key} style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--dim)' }}>{f.label}</span>
              <input
                value={brief[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => setBrief((b) => ({ ...b, [f.key]: e.target.value }))}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  background: 'var(--elev)',
                  color: 'var(--text)',
                }}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          className="cy-btn-ghost"
          disabled={pending}
          style={{ marginTop: 8 }}
          onClick={() => {
            startTransition(async () => {
              setErr('')
              setMsg('')
              const res = await savePropertyListingBrief(propertyId, brief)
              if (!res.success) setErr(res.error)
              else setMsg('Listing fields saved.')
            })
          }}
        >
          Save listing fields
        </button>
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
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 8px',
                background: 'var(--elev)',
              }}
            />
            <textarea
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              rows={6}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 10,
                background: 'var(--elev)',
              }}
            />
            <input
              value={draftHighlights}
              onChange={(e) => setDraftHighlights(e.target.value)}
              placeholder="Highlights (comma-separated)"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 8px',
                background: 'var(--elev)',
              }}
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
