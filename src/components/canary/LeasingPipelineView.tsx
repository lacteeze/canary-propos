'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Calendar, ChevronDown, Mail, Phone, Plus, Trash2 } from 'lucide-react'
import {
  addInquiryNote,
  deleteInquiry,
  listInquiryNotes,
  updateInquiryStatus,
  updateInquiryViewingAt,
} from '@/app/actions/inquiries'
import {
  INQUIRY_PIPELINE_LABELS,
  INQUIRY_PIPELINE_STAGES,
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

/** Compact move-in for the card badge (top-right). */
function formatMoveInBadge(moveIn: string): string {
  if (!moveIn) return 'TBD'
  const d = new Date(moveIn + (moveIn.length === 10 ? 'T12:00:00' : ''))
  if (Number.isNaN(d.getTime())) return 'TBD'
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatViewingAt(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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

type SaveTone = 'idle' | 'saving' | 'saved' | 'error'

const ACTIONS_HOVER_DELAY_MS = 5000

function prefersNoHover(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: none)').matches
}

type PipelineCardProps = {
  inquiry: CanaryInquiry
  selected: boolean
  dragging: boolean
  noteDraft: string
  onSelect: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onNoteChange: (value: string) => void
  onSubmitNote: () => void
  onDelete: () => void
  onAdvance: () => void
}

function PipelineCard({
  inquiry,
  selected,
  dragging,
  noteDraft,
  onSelect,
  onDragStart,
  onDragEnd,
  onNoteChange,
  onSubmitNote,
  onDelete,
  onAdvance,
}: PipelineCardProps) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hovering = useRef(false)
  const actionsFocusedRef = useRef(false)

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }, [])

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer])

  const onCardEnter = () => {
    hovering.current = true
    if (prefersNoHover() || actionsFocusedRef.current || actionsOpen) return
    clearHoverTimer()
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null
      setActionsOpen(true)
    }, ACTIONS_HOVER_DELAY_MS)
  }

  const onCardLeave = () => {
    hovering.current = false
    clearHoverTimer()
    if (!actionsFocusedRef.current) setActionsOpen(false)
  }

  const toggleActions = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    clearHoverTimer()
    setActionsOpen((open) => {
      if (open) {
        actionsFocusedRef.current = false
        const active = document.activeElement
        if (active instanceof HTMLElement) active.blur()
      }
      return !open
    })
  }

  const onPanelFocusCapture = () => {
    actionsFocusedRef.current = true
    setActionsOpen(true)
    clearHoverTimer()
  }

  const onPanelBlurCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    actionsFocusedRef.current = false
    if (!hovering.current) setActionsOpen(false)
  }

  return (
    <article
      className={`cy-pipeline-card${selected ? ' is-selected' : ''}${
        dragging ? ' is-dragging' : ''
      }${actionsOpen ? ' is-actions-open' : ''}`}
      draggable
      onDragStart={(e) => {
        clearHoverTimer()
        onDragStart(e)
      }}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onMouseEnter={onCardEnter}
      onMouseLeave={onCardLeave}
    >
      <div className="cy-pipeline-card-top">
        <div>
          <div className="cy-pipeline-card-name">{inquiry.name}</div>
          <div className="cy-pipeline-card-prop">{shortProperty(inquiry.property)}</div>
        </div>
        <span className="cy-pipeline-movein" title="Desired move-in">
          {formatMoveInBadge(inquiry.moveIn)}
        </span>
      </div>

      {inquiry.status === 'viewing' && inquiry.viewingAt ? (
        <div className="cy-pipeline-card-meta">
          <Calendar size={13} aria-hidden />
          <span>{`Viewing ${formatViewingAt(inquiry.viewingAt)}`}</span>
        </div>
      ) : null}

      {inquiry.latestNote && (
        <div className="cy-pipeline-card-note">
          <div className="cy-pipeline-card-note-body">{inquiry.latestNote.body}</div>
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
        <button
          type="button"
          className="cy-pipeline-actions-toggle"
          aria-label={actionsOpen ? 'Hide card actions' : 'Show card actions'}
          aria-expanded={actionsOpen}
          onClick={toggleActions}
          onMouseDown={(e) => {
            // Keep note focus from bluring before toggle runs; stop card drag.
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <ChevronDown size={14} aria-hidden />
        </button>

        <div
          className="cy-pipeline-card-actions-panel"
          aria-hidden={!actionsOpen}
          onFocusCapture={onPanelFocusCapture}
          onBlurCapture={onPanelBlurCapture}
        >
          <div className="cy-pipeline-card-actions-inner">
            <div className="cy-pipeline-note-row">
              <input
                type="text"
                placeholder="Log a call or note…"
                value={noteDraft}
                tabIndex={actionsOpen ? 0 : -1}
                onChange={(e) => onNoteChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onSubmitNote()
                  }
                }}
              />
              <button
                type="button"
                className="cy-pipeline-icon-btn"
                aria-label="Add note"
                tabIndex={actionsOpen ? 0 : -1}
                onClick={onSubmitNote}
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="cy-pipeline-card-btns">
              <button
                type="button"
                className="cy-pipeline-icon-btn is-danger"
                aria-label="Delete inquiry"
                tabIndex={actionsOpen ? 0 : -1}
                onClick={onDelete}
              >
                <Trash2 size={14} />
              </button>
              <button
                type="button"
                className="cy-pipeline-advance"
                aria-label="Advance stage"
                tabIndex={actionsOpen ? 0 : -1}
                disabled={!nextInquiryStage(inquiry.status)}
                onClick={onAdvance}
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

type Props = {
  inquiries: CanaryInquiry[]
  /** Debounced background sync only — never awaited for UI. */
  onChanged?: () => void
}

export function LeasingPipelineView({ inquiries: initial, onChanged }: Props) {
  const [items, setItems] = useState(initial)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [detailNotes, setDetailNotes] = useState<CanaryInquiryNote[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saveTone, setSaveTone] = useState<SaveTone>('idle')
  const [saveMessage, setSaveMessage] = useState('')

  /** Inquiry ids with in-flight optimistic mutations — protect from parent prop clobber. */
  const dirtyIds = useRef(new Set<string>())
  /** Deleted locally while server delete is in flight. */
  const deletedIds = useRef(new Set<string>())
  /** Latest desired status per inquiry (coalesces rapid moves). */
  const statusQueue = useRef(new Map<string, InquiryStatus>())
  const statusFlushing = useRef(new Set<string>())
  const inFlightCount = useRef(0)
  const savedClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const parentSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshots = useRef(new Map<string, CanaryInquiry>())

  const bumpSaving = useCallback(() => {
    inFlightCount.current += 1
    if (savedClearTimer.current) clearTimeout(savedClearTimer.current)
    setSaveTone('saving')
    setSaveMessage('Saving…')
  }, [])

  const bumpDone = useCallback((ok: boolean, message?: string) => {
    inFlightCount.current = Math.max(0, inFlightCount.current - 1)
    if (!ok) {
      setSaveTone('error')
      setSaveMessage(message || 'Save failed')
      setError(message || 'Save failed')
      return
    }
    if (inFlightCount.current === 0) {
      setSaveTone('saved')
      setSaveMessage('Saved')
      if (savedClearTimer.current) clearTimeout(savedClearTimer.current)
      savedClearTimer.current = setTimeout(() => {
        setSaveTone('idle')
        setSaveMessage('')
      }, 1600)
    }
  }, [])

  const scheduleParentSync = useCallback(() => {
    if (!onChanged) return
    if (parentSyncTimer.current) clearTimeout(parentSyncTimer.current)
    parentSyncTimer.current = setTimeout(() => {
      onChanged()
    }, 2800)
  }, [onChanged])

  // Soft-merge server props; never wipe optimistic dirty rows mid-save.
  useEffect(() => {
    setItems((prev) => {
      const prevById = new Map(prev.map((i) => [i.id, i]))
      const next: CanaryInquiry[] = []
      for (const server of initial) {
        if (deletedIds.current.has(server.id)) continue
        if (dirtyIds.current.has(server.id)) {
          next.push(prevById.get(server.id) ?? server)
        } else {
          next.push(server)
        }
      }
      // Keep optimistic rows that parent hasn't caught up with yet (e.g. just created notes only)
      for (const local of prev) {
        if (deletedIds.current.has(local.id)) continue
        if (!next.some((i) => i.id === local.id) && dirtyIds.current.has(local.id)) {
          next.push(local)
        }
      }
      return next
    })
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
    return items.filter((i) => {
      if (i.status === 'closed') return false
      if (!q) return true
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

  const flushStatus = useCallback(
    async (id: string) => {
      if (statusFlushing.current.has(id)) return
      statusFlushing.current.add(id)
      bumpSaving()
      try {
        while (statusQueue.current.has(id)) {
          const status = statusQueue.current.get(id)!
          statusQueue.current.delete(id)
          const result = await updateInquiryStatus(id, status)
          if (result.error) {
            const snap = snapshots.current.get(id)
            if (snap) {
              setItems((list) => list.map((i) => (i.id === id ? snap : i)))
            }
            dirtyIds.current.delete(id)
            bumpDone(false, result.error)
            statusFlushing.current.delete(id)
            return
          }
        }
        dirtyIds.current.delete(id)
        snapshots.current.delete(id)
        bumpDone(true)
        scheduleParentSync()
      } catch (e) {
        const snap = snapshots.current.get(id)
        if (snap) {
          setItems((list) => list.map((i) => (i.id === id ? snap : i)))
        }
        dirtyIds.current.delete(id)
        bumpDone(false, e instanceof Error ? e.message : 'Save failed')
      } finally {
        statusFlushing.current.delete(id)
        // Another move queued while we were finishing
        if (statusQueue.current.has(id)) {
          void flushStatus(id)
        }
      }
    },
    [bumpDone, bumpSaving, scheduleParentSync],
  )

  function moveInquiry(id: string, status: InquiryStatus) {
    const current = items.find((i) => i.id === id)
    if (!current || current.status === status) return

    if (!snapshots.current.has(id)) {
      snapshots.current.set(id, current)
    }
    dirtyIds.current.add(id)
    setError(null)
    setItems((list) => list.map((i) => (i.id === id ? { ...i, status } : i)))

    statusQueue.current.set(id, status)
    void flushStatus(id)
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

    const created: CanaryInquiryNote = {
      id: crypto.randomUUID(),
      body,
      createdAt: new Date().toISOString(),
      authorName: 'You',
    }
    dirtyIds.current.add(inquiryId)
    setItems((list) =>
      list.map((i) => (i.id === inquiryId ? { ...i, latestNote: created } : i)),
    )
    if (selectedId === inquiryId) {
      setDetailNotes((n) => [created, ...n])
    }

    bumpSaving()
    void addInquiryNote(inquiryId, body).then((result) => {
      if (result.error) {
        setNoteDrafts((d) => ({ ...d, [inquiryId]: body }))
        setItems((list) =>
          list.map((i) =>
            i.id === inquiryId && i.latestNote?.id === created.id
              ? { ...i, latestNote: null }
              : i,
          ),
        )
        if (selectedId === inquiryId) {
          setDetailNotes((n) => n.filter((x) => x.id !== created.id))
        }
        dirtyIds.current.delete(inquiryId)
        bumpDone(false, result.error)
        return
      }
      if (result.noteId) {
        const realId = result.noteId
        setItems((list) =>
          list.map((i) =>
            i.id === inquiryId && i.latestNote?.id === created.id
              ? { ...i, latestNote: { ...created, id: realId } }
              : i,
          ),
        )
        if (selectedId === inquiryId) {
          setDetailNotes((n) =>
            n.map((x) => (x.id === created.id ? { ...x, id: realId } : x)),
          )
        }
      }
      dirtyIds.current.delete(inquiryId)
      bumpDone(true)
      scheduleParentSync()
    })
  }

  function removeInquiry(inquiry: CanaryInquiry) {
    const ok = window.confirm(
      `Remove ${inquiry.name} from the pipeline?\n\nThis permanently deletes the inquiry.`,
    )
    if (!ok) return

    const snap = inquiry
    deletedIds.current.add(inquiry.id)
    dirtyIds.current.add(inquiry.id)
    setItems((list) => list.filter((i) => i.id !== inquiry.id))
    if (selectedId === inquiry.id) setSelectedId(null)
    setError(null)

    bumpSaving()
    void deleteInquiry(inquiry.id).then((result) => {
      if (result.error) {
        deletedIds.current.delete(inquiry.id)
        dirtyIds.current.delete(inquiry.id)
        setItems((list) => {
          if (list.some((i) => i.id === snap.id)) return list
          return [snap, ...list]
        })
        bumpDone(false, result.error)
        return
      }
      dirtyIds.current.delete(inquiry.id)
      snapshots.current.delete(inquiry.id)
      bumpDone(true)
      scheduleParentSync()
    })
  }

  function saveViewingAt(inquiryId: string, value: string) {
    const iso = value ? new Date(value).toISOString() : null
    if (value && (!iso || Number.isNaN(new Date(value).getTime()))) {
      setError('Invalid viewing date.')
      return
    }

    const current = items.find((i) => i.id === inquiryId)
    if (!current) return
    if (!snapshots.current.has(inquiryId)) {
      snapshots.current.set(inquiryId, current)
    }
    dirtyIds.current.add(inquiryId)
    setItems((list) =>
      list.map((i) =>
        i.id === inquiryId
          ? {
              ...i,
              viewingAt: iso,
              status: iso ? 'viewing' : i.status,
            }
          : i,
      ),
    )
    setError(null)

    bumpSaving()
    void updateInquiryViewingAt(inquiryId, iso).then((result) => {
      if (result.error) {
        const snap = snapshots.current.get(inquiryId)
        if (snap) {
          setItems((list) => list.map((i) => (i.id === inquiryId ? snap : i)))
        }
        dirtyIds.current.delete(inquiryId)
        bumpDone(false, result.error)
        return
      }
      dirtyIds.current.delete(inquiryId)
      snapshots.current.delete(inquiryId)
      bumpDone(true)
      scheduleParentSync()
    })
  }

  return (
    <section className="cy-pipeline">
      <div className="cy-pipeline-head">
        <div>
          <h2 className="cy-pipeline-title">Leasing pipeline</h2>
        </div>
        <div className="cy-pipeline-head-right">
          {saveTone !== 'idle' && (
            <span
              className={`cy-pipeline-save-pill is-${saveTone}`}
              aria-live="polite"
            >
              {saveMessage}
            </span>
          )}
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
      </div>

      {error && (
        <div className="cy-pipeline-error" role="alert">
          {error}
          <button
            type="button"
            className="cy-pipeline-error-dismiss"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
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
                <PipelineCard
                  key={inquiry.id}
                  inquiry={inquiry}
                  selected={selectedId === inquiry.id}
                  dragging={dragId === inquiry.id}
                  noteDraft={noteDrafts[inquiry.id] ?? ''}
                  onSelect={() => setSelectedId(inquiry.id)}
                  onDragStart={(e) => {
                    setDragId(inquiry.id)
                    e.dataTransfer.setData('text/inquiry-id', inquiry.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => setDragId(null)}
                  onNoteChange={(value) =>
                    setNoteDrafts((d) => ({ ...d, [inquiry.id]: value }))
                  }
                  onSubmitNote={() => submitNote(inquiry.id)}
                  onDelete={() => removeInquiry(inquiry)}
                  onAdvance={() => advance(inquiry)}
                />
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
              <div>
                <dt>Viewing</dt>
                <dd>
                  <input
                    type="datetime-local"
                    className="cy-pipeline-datetime"
                    value={toDatetimeLocalValue(selected.viewingAt)}
                    onChange={(e) => saveViewingAt(selected.id, e.target.value)}
                  />
                </dd>
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

            <div className="cy-pipeline-drawer-foot">
              <button
                type="button"
                className="cy-btn"
                style={{ color: 'var(--dim)' }}
                onClick={() => {
                  moveInquiry(selected.id, 'closed')
                  setSelectedId(null)
                }}
              >
                Close / mark lost
              </button>
              <button
                type="button"
                className="cy-btn cy-pipeline-delete-btn"
                onClick={() => removeInquiry(selected)}
              >
                <Trash2 size={14} aria-hidden /> Delete
              </button>
            </div>
          </aside>
        </>
      )}
    </section>
  )
}
