'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { Calendar, Mail, Phone, Plus, ArrowRight } from 'lucide-react'
import {
  addInquiryNote,
  listInquiryNotes,
  updateInquiryStatus,
} from '@/app/actions/inquiries'
import {
  INQUIRY_PIPELINE_LABELS,
  INQUIRY_PIPELINE_STAGES,
  inquiryTypeLabel,
  nextInquiryStage,
  type CanaryInquiry,
  type CanaryInquiryNote,
  type InquiryStatus,
} from '@/lib/canary/types'

function relativeAge(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const days = Math.floor((Date.now() - t) / 864e5)
  if (days <= 0) return 'Today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function formatMoveIn(moveIn: string): string {
  if (!moveIn) return 'Move-in TBD'
  const d = new Date(moveIn + (moveIn.length === 10 ? 'T12:00:00' : ''))
  if (Number.isNaN(d.getTime())) return `Wants ${moveIn}`
  return `Wants ${d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function shortProperty(address: string): string {
  const street = address.split(',')[0]?.trim() || address
  return street.length > 42 ? `${street.slice(0, 40)}…` : street
}

type Props = {
  inquiries: CanaryInquiry[]
  onChanged?: () => void
}

export function LeasingPipelineView({ inquiries: initial, onChanged }: Props) {
  const [items, setItems] = useState(initial)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [detailNotes, setDetailNotes] = useState<CanaryInquiryNote[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setItems(initial)
  }, [initial])

  const selected = items.find((i) => i.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId) {
      setDetailNotes([])
      return
    }
    let cancelled = false
    void listInquiryNotes(selectedId).then((notes) => {
      if (!cancelled) setDetailNotes(notes)
    })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.filter((i) => i.status !== 'closed')
    return items.filter((i) => {
      if (i.status === 'closed') return false
      return (
        i.name.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        i.property.toLowerCase().includes(q) ||
        i.phone.toLowerCase().includes(q)
      )
    })
  }, [items, query])

  const byStage = useMemo(() => {
    const map = Object.fromEntries(
      INQUIRY_PIPELINE_STAGES.map((s) => [s, [] as CanaryInquiry[]]),
    ) as Record<InquiryStatus, CanaryInquiry[]>
    for (const i of filtered) {
      if (map[i.status]) map[i.status].push(i)
    }
    return map
  }, [filtered])

  function moveInquiry(id: string, status: InquiryStatus) {
    const prev = items
    setItems((list) => list.map((i) => (i.id === id ? { ...i, status } : i)))
    setError(null)
    startTransition(async () => {
      const result = await updateInquiryStatus(id, status)
      if (result.error) {
        setItems(prev)
        setError(result.error)
        return
      }
      onChanged?.()
    })
  }

  function advance(inquiry: CanaryInquiry) {
    const next = nextInquiryStage(inquiry.status)
    if (next) moveInquiry(inquiry.id, next)
  }

  function submitNote(inquiryId: string) {
    const body = (noteDrafts[inquiryId] ?? '').trim()
    if (!body) return
    setNoteDrafts((d) => ({ ...d, [inquiryId]: '' }))
    setError(null)
    startTransition(async () => {
      const result = await addInquiryNote(inquiryId, body)
      if (result.error) {
        setError(result.error)
        setNoteDrafts((d) => ({ ...d, [inquiryId]: body }))
        return
      }
      const created: CanaryInquiryNote = {
        id: result.noteId ?? crypto.randomUUID(),
        body,
        createdAt: new Date().toISOString(),
        authorName: 'You',
      }
      setItems((list) =>
        list.map((i) => (i.id === inquiryId ? { ...i, latestNote: created } : i)),
      )
      if (selectedId === inquiryId) {
        setDetailNotes((n) => [created, ...n])
      }
      onChanged?.()
    })
  }

  return (
    <section className="cy-pipeline">
      <div className="cy-pipeline-head">
        <div>
          <h2 className="cy-pipeline-title">Leasing pipeline</h2>
        </div>
        <label className="cy-pipeline-search">
          <span aria-hidden>⌕</span>
          <input
            type="search"
            placeholder="Search prospects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <div className="cy-pipeline-error" role="alert">
          {error}
        </div>
      )}

      <div className="cy-pipeline-board">
        {INQUIRY_PIPELINE_STAGES.map((stage) => (
          <div
            key={stage}
            className="cy-pipeline-col"
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData('text/inquiry-id') || dragId
              setDragId(null)
              if (!id) return
              const item = items.find((i) => i.id === id)
              if (!item || item.status === stage) return
              moveInquiry(id, stage)
            }}
          >
            <div className="cy-pipeline-col-head">
              <span>{INQUIRY_PIPELINE_LABELS[stage]}</span>
              <span className="cy-pipeline-col-count">{byStage[stage].length}</span>
            </div>
            <div className="cy-pipeline-col-body">
              {byStage[stage].map((inquiry) => (
                <article
                  key={inquiry.id}
                  className={`cy-pipeline-card${selectedId === inquiry.id ? ' is-selected' : ''}${
                    dragId === inquiry.id ? ' is-dragging' : ''
                  }`}
                  draggable={!pending}
                  onDragStart={(e) => {
                    setDragId(inquiry.id)
                    e.dataTransfer.setData('text/inquiry-id', inquiry.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => setSelectedId(inquiry.id)}
                >
                  <div className="cy-pipeline-card-top">
                    <div>
                      <div className="cy-pipeline-card-name">{inquiry.name}</div>
                      <div className="cy-pipeline-card-prop">{shortProperty(inquiry.property)}</div>
                    </div>
                    <span
                      className={`cy-pipeline-term${
                        inquiry.type === 'application'
                          ? ' is-app'
                          : inquiry.isGeneralInterest
                            ? ' is-interest'
                            : ''
                      }`}
                    >
                      {inquiryTypeLabel(inquiry)}
                    </span>
                  </div>

                  <div className="cy-pipeline-card-meta">
                    <Calendar size={13} aria-hidden />
                    <span>{formatMoveIn(inquiry.moveIn)}</span>
                  </div>

                  {inquiry.latestNote && (
                    <div className="cy-pipeline-card-note">
                      <div className="cy-pipeline-card-note-body">
                        {inquiry.latestNote.body}
                      </div>
                      <div className="cy-pipeline-card-note-age">
                        {relativeAge(inquiry.latestNote.createdAt)}
                      </div>
                    </div>
                  )}

                  <div
                    className="cy-pipeline-card-actions"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <div className="cy-pipeline-note-row">
                      <input
                        type="text"
                        placeholder="Log a call or note…"
                        value={noteDrafts[inquiry.id] ?? ''}
                        onChange={(e) =>
                          setNoteDrafts((d) => ({ ...d, [inquiry.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            submitNote(inquiry.id)
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="cy-pipeline-icon-btn"
                        aria-label="Add note"
                        disabled={pending}
                        onClick={() => submitNote(inquiry.id)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="cy-pipeline-card-btns">
                      <button
                        type="button"
                        className="cy-pipeline-advance"
                        aria-label="Advance stage"
                        disabled={pending || !nextInquiryStage(inquiry.status)}
                        onClick={() => advance(inquiry)}
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!byStage[stage].length && (
                <div className="cy-pipeline-empty">No prospects</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <>
          <button
            type="button"
            className="cy-pipeline-drawer-backdrop"
            aria-label="Close prospect details"
            onClick={() => setSelectedId(null)}
          />
          <aside className="cy-pipeline-drawer" aria-label="Prospect details">
            <div className="cy-pipeline-drawer-head">
              <div className="cy-pipeline-avatar">{initials(selected.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cy-pipeline-card-name">{selected.name}</div>
                <div className="cy-pipeline-card-prop">{selected.property}</div>
              </div>
              <button type="button" className="cy-btn" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>

            <div className="cy-pipeline-contact-row">
              <a className="cy-btn" href={`mailto:${selected.email}`}>
                <Mail size={14} aria-hidden /> Email
              </a>
              {selected.phone ? (
                <a className="cy-btn" href={`tel:${selected.phone}`}>
                  <Phone size={14} aria-hidden /> Call
                </a>
              ) : (
                <button type="button" className="cy-btn" disabled>
                  <Phone size={14} aria-hidden /> Call
                </button>
              )}
            </div>

            <dl className="cy-pipeline-dl">
              <div>
                <dt>Email</dt>
                <dd>{selected.email}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{selected.phone || '—'}</dd>
              </div>
              <div>
                <dt>Inquiry type</dt>
                <dd>
                  {selected.isGeneralInterest
                    ? 'General interest'
                    : selected.type === 'application'
                      ? 'Application interest'
                      : 'Showing request'}
                </dd>
              </div>
              <div>
                <dt>Wants</dt>
                <dd>{formatMoveIn(selected.moveIn)}</dd>
              </div>
              {selected.note ? (
                <div>
                  <dt>Their note</dt>
                  <dd>{selected.note}</dd>
                </div>
              ) : null}
            </dl>

            <div className="cy-pipeline-stages">
              {INQUIRY_PIPELINE_STAGES.map((stage, idx) => {
                const currentIdx = INQUIRY_PIPELINE_STAGES.indexOf(selected.status)
                const active = stage === selected.status
                const done = currentIdx > idx
                return (
                  <button
                    key={stage}
                    type="button"
                    className={`cy-pipeline-stage${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                    disabled={pending}
                    onClick={() => moveInquiry(selected.id, stage)}
                  >
                    <span className="cy-pipeline-stage-dot" />
                    {INQUIRY_PIPELINE_LABELS[stage]}
                  </button>
                )
              })}
            </div>

            <div className="cy-pipeline-notes-block">
              <div className="cy-mono-label" style={{ marginBottom: 8 }}>
                Notes & activity
              </div>
              <div className="cy-pipeline-note-row">
                <input
                  type="text"
                  placeholder="Log a call, email, or note…"
                  value={noteDrafts[selected.id] ?? ''}
                  onChange={(e) =>
                    setNoteDrafts((d) => ({ ...d, [selected.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submitNote(selected.id)
                    }
                  }}
                />
                <button
                  type="button"
                  className="cy-btn"
                  disabled={pending}
                  onClick={() => submitNote(selected.id)}
                >
                  Add
                </button>
              </div>
              {detailNotes.length === 0 ? (
                <p className="cy-pipeline-empty" style={{ marginTop: 12 }}>
                  No notes yet. Log your first call or email above.
                </p>
              ) : (
                <ul className="cy-pipeline-note-list">
                  {detailNotes.map((n) => (
                    <li key={n.id}>
                      <div>{n.body}</div>
                      <div className="cy-pipeline-card-note-age">
                        {n.authorName} · {relativeAge(n.createdAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              className="cy-btn"
              style={{ marginTop: 16, color: 'var(--dim)' }}
              disabled={pending}
              onClick={() => {
                moveInquiry(selected.id, 'closed')
                setSelectedId(null)
              }}
            >
              Close / mark lost
            </button>
          </aside>
        </>
      )}
    </section>
  )
}
