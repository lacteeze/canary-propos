'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Archive, ArchiveRestore, Ban, Trash2 } from 'lucide-react'
import {
  bulkArchiveInboxMessages,
  bulkDeleteInboxMessages,
  clearInboxSenderPropertyLink,
  getInboxCategoryCounts,
  getInboxSyncStatus,
  linkInboxSenderToProperty,
  listInboxMessages,
  listInboxPropertyOptions,
  listMutedSenders,
  markInboxMessageRead,
  muteInboxSender,
  setInboxMessageArchived,
  syncGmailInbox,
  unmuteInboxSender,
  updateInboxMessageCategory,
  type InboxPropertyOption,
} from '@/app/actions/inbox'
import {
  EMAIL_CATEGORIES,
  type EmailCategory,
  type InboxMessage,
  type InboxSyncStatus,
} from '@/lib/gmail/types'

type InboxFilter = EmailCategory | 'all' | 'unread' | 'archived'

const FILTERS: { key: InboxFilter; label: string }[] = [
  { key: 'needs_review', label: 'Needs review' },
  { key: 'unread', label: 'Unread' },
  { key: 'all', label: 'All' },
  { key: 'tenant', label: 'Tenant' },
  { key: 'owner', label: 'Owner' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'receipt', label: 'Receipt' },
  { key: 'etransfer', label: 'E-transfer' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'spam', label: 'Spam' },
  { key: 'internal', label: 'Internal' },
  { key: 'other', label: 'Other' },
  { key: 'archived', label: 'Archived' },
]

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function gmailPermalink(gmailMessageId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${gmailMessageId}`
}

function categoryLabel(c: EmailCategory): string {
  return c.replace(/_/g, ' ')
}

type PropertyPickItem = {
  value: string
  label: string
  fullAddress: string
  searchText: string
}

function InboxPropertyCombobox({
  options,
  value,
  disabled,
  title,
  onChange,
}: {
  options: InboxPropertyOption[]
  value: string
  disabled: boolean
  title: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const allItems = useMemo((): PropertyPickItem[] => {
    return [
      { value: '', label: 'Not linked', fullAddress: '', searchText: 'not linked' },
      ...options.map((p) => ({
        value: `${p.propertyId}::${p.unitId}`,
        label: p.label,
        fullAddress: p.address,
        searchText: `${p.label} ${p.address}`.toLowerCase(),
      })),
    ]
  }, [options])

  const selected = useMemo(() => {
    if (!value) return { label: 'Not linked', title: title }
    const hit = options.find((p) => `${p.propertyId}::${p.unitId}` === value)
    return {
      label: hit?.label ?? 'Not linked',
      title: hit?.address ? `${title}\n${hit.address}` : title,
    }
  }, [value, options, title])

  const filtered = useMemo((): PropertyPickItem[] => {
    const q = query.trim().toLowerCase()
    if (!q) return allItems
    return allItems.filter((item) => item.searchText.includes(q))
  }, [allItems, query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setHighlight(0)
  }, [])

  const pick = useCallback(
    (next: string) => {
      close()
      if (next !== value) onChange(next)
    },
    [close, onChange, value],
  )

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, close])

  const openPicker = useCallback(() => {
    if (disabled) return
    const idx = allItems.findIndex((item) => item.value === value)
    setQuery('')
    setHighlight(idx >= 0 ? idx : 0)
    setOpen(true)
  }, [disabled, allItems, value])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPicker()
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[highlight]
      if (item) pick(item.value)
    }
  }

  return (
    <div className="cy-inbox-property-combobox" ref={rootRef} title={selected.title}>
      <button
        type="button"
        className="cy-inbox-property-combobox__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return
          if (open) close()
          else openPicker()
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="cy-inbox-property-combobox__value">{selected.label}</span>
        <span className="cy-inbox-property-combobox__caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="cy-inbox-property-combobox__popover">
          <input
            ref={inputRef}
            type="search"
            className="cy-inbox-property-combobox__search"
            placeholder="Search properties…"
            value={query}
            disabled={disabled}
            aria-autocomplete="list"
            aria-controls="cy-inbox-property-listbox"
            onChange={(e) => {
              setQuery(e.target.value)
              setHighlight(0)
            }}
            onKeyDown={onInputKeyDown}
          />
          <ul
            ref={listRef}
            id="cy-inbox-property-listbox"
            className="cy-inbox-property-combobox__list"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="cy-inbox-property-combobox__empty">No matches</li>
            ) : (
              filtered.map((item, idx) => {
                const isSelected = item.value === value
                const active = idx === highlight
                return (
                  <li
                    key={item.value || '__none__'}
                    data-idx={idx}
                    role="option"
                    aria-selected={isSelected}
                    title={item.fullAddress || undefined}
                    className={[
                      'cy-inbox-property-combobox__option',
                      active ? 'is-active' : '',
                      isSelected ? 'is-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onMouseEnter={() => setHighlight(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pick(item.value)
                    }}
                  >
                    {item.label}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default function GmailInboxView() {
  const [filter, setFilter] = useState<InboxFilter>('needs_review')
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [status, setStatus] = useState<InboxSyncStatus | null>(null)
  const [mutedSenders, setMutedSenders] = useState<string[]>([])
  const [propertyOptions, setPropertyOptions] = useState<InboxPropertyOption[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMutedPanel, setShowMutedPanel] = useState(false)
  const [, startTransition] = useTransition()
  const didAutoSync = useRef(false)

  const selected = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId],
  )

  const allChecked = messages.length > 0 && messages.every((m) => checkedIds.has(m.id))
  const someChecked = checkedIds.size > 0

  const refresh = useCallback(async (cat: InboxFilter) => {
    setError(null)
    const [msgs, cts, st, muted, props] = await Promise.all([
      listInboxMessages({ category: cat }),
      getInboxCategoryCounts(),
      getInboxSyncStatus(),
      listMutedSenders(),
      listInboxPropertyOptions(),
    ])
    setMessages(msgs)
    setCounts(cts)
    setStatus(st)
    setMutedSenders(muted)
    setPropertyOptions(props)
    setCheckedIds((prev) => {
      const next = new Set<string>()
      for (const id of prev) {
        if (msgs.some((m) => m.id === id)) next.add(id)
      }
      return next
    })
    setSelectedId((prev) => {
      if (prev && msgs.some((m) => m.id === prev)) return prev
      return msgs[0]?.id ?? null
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    setCheckedIds(new Set())
    refresh(filter).finally(() => setLoading(false))
  }, [filter, refresh])

  useEffect(() => {
    if (!status?.connected || didAutoSync.current) return
    const last = status.lastSyncAt ? new Date(status.lastSyncAt).getTime() : 0
    const stale = !last || Date.now() - last > 10 * 60 * 1000
    if (!stale) return
    didAutoSync.current = true
    let cancelled = false
    ;(async () => {
      setSyncing(true)
      const result = await syncGmailInbox()
      if (cancelled) return
      if (!result.success) setError(result.error)
      await refresh(filter)
      setSyncing(false)
    })()
    return () => {
      cancelled = true
    }
  }, [status?.connected, status?.lastSyncAt, filter, refresh])

  async function handleSync() {
    setError(null)
    if (!status?.connected) {
      setError('Gmail is not connected. Open Settings and connect Gmail first.')
      return
    }
    setSyncing(true)
    try {
      const result = await syncGmailInbox()
      if (!result.success) setError(result.error)
      await refresh(filter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSelect(msg: InboxMessage) {
    setSelectedId(msg.id)
    if (msg.isUnread) {
      startTransition(async () => {
        await markInboxMessageRead(msg.id, false)
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, isUnread: false } : m)),
        )
        setCounts((c) => ({
          ...c,
          unread: Math.max(0, (c.unread ?? 1) - 1),
        }))
      })
    }
  }

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCheckAll() {
    if (allChecked) setCheckedIds(new Set())
    else setCheckedIds(new Set(messages.map((m) => m.id)))
  }

  async function handleRecategorize(category: EmailCategory) {
    if (!selected) return
    const result = await updateInboxMessageCategory(selected.id, category)
    if (!result.success) {
      setError(result.error)
      return
    }
    await refresh(filter)
  }

  async function handleArchive(messageId: string, archived: boolean) {
    setError(null)
    const result = await setInboxMessageArchived(messageId, archived)
    if (!result.success) {
      setError(result.error)
      return
    }
    await refresh(filter)
  }

  async function handleBulkArchive(archived: boolean) {
    if (checkedIds.size === 0) return
    setBusy(true)
    setError(null)
    const result = await bulkArchiveInboxMessages([...checkedIds], archived)
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setCheckedIds(new Set())
    await refresh(filter)
  }

  async function handleBulkDelete() {
    if (checkedIds.size === 0) return
    const n = checkedIds.size
    if (!window.confirm(`Delete ${n} message${n === 1 ? '' : 's'} from PropOS? This does not delete them in Gmail.`)) {
      return
    }
    setBusy(true)
    setError(null)
    const result = await bulkDeleteInboxMessages([...checkedIds])
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setCheckedIds(new Set())
    await refresh(filter)
  }

  async function handleMuteSender(email: string | null) {
    if (!email) return
    setBusy(true)
    setError(null)
    const result = await muteInboxSender(email)
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    await refresh(filter)
  }

  async function handleUnmute(email: string) {
    setBusy(true)
    setError(null)
    const result = await unmuteInboxSender(email)
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    await refresh(filter)
  }

  async function handleLinkProperty(value: string) {
    if (!selected?.fromEmail) return
    setBusy(true)
    setError(null)

    if (!value) {
      const result = await clearInboxSenderPropertyLink(selected.fromEmail)
      setBusy(false)
      if (!result.success) {
        setError(result.error)
        return
      }
      await refresh(filter)
      return
    }

    const [propertyId, unitId] = value.split('::')
    const result = await linkInboxSenderToProperty({
      email: selected.fromEmail,
      propertyId,
      unitId: unitId || null,
      messageId: selected.id,
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    await refresh(filter)
  }

  const selectedPropertyValue = useMemo(() => {
    if (!selected?.matchedPropertyId) return ''
    if (selected.matchedUnitId) {
      const hit = propertyOptions.find(
        (p) =>
          p.propertyId === selected.matchedPropertyId && p.unitId === selected.matchedUnitId,
      )
      if (hit) return `${hit.propertyId}::${hit.unitId}`
    }
    const byProp = propertyOptions.find((p) => p.propertyId === selected.matchedPropertyId)
    return byProp ? `${byProp.propertyId}::${byProp.unitId}` : ''
  }, [selected, propertyOptions])

  const syncLabel = !status?.connected
    ? 'Gmail not connected — link it in Settings'
    : status.lastSyncError
      ? `Sync error: ${status.lastSyncError}`
      : status.lastSyncAt
        ? `Last sync ${formatWhen(status.lastSyncAt)}`
        : 'Not synced yet'

  return (
    <section className="cy-inbox">
      <div className="cy-inbox-toolbar">
        <div>
          <h1 className="cy-inbox-title">Email</h1>
          <p className="cy-inbox-sub">{syncLabel}</p>
        </div>
        <div className="cy-inbox-toolbar-actions">
          <button
            type="button"
            className="cy-btn-ghost"
            onClick={() => setShowMutedPanel((v) => !v)}
          >
            Hidden senders{mutedSenders.length ? ` (${mutedSenders.length})` : ''}
          </button>
          {!status?.connected && status !== null && (
            <a className="cy-btn-ghost" href="/settings">
              Connect Gmail in Settings
            </a>
          )}
          <button
            type="button"
            className="cy-btn"
            disabled={syncing || status === null}
            onClick={handleSync}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      {showMutedPanel && (
        <div className="cy-inbox-muted-panel">
          <div className="cy-inbox-muted-head">
            <strong>Hidden senders</strong>
            <span className="cy-inbox-dim">
              Notifications from these addresses are archived and kept out of active views.
            </span>
          </div>
          {mutedSenders.length === 0 ? (
            <p className="cy-inbox-dim" style={{ margin: 0 }}>
              None yet — open a message and choose “Hide sender”.
            </p>
          ) : (
            <ul className="cy-inbox-muted-list">
              {mutedSenders.map((email) => (
                <li key={email}>
                  <span>{email}</span>
                  <button
                    type="button"
                    className="cy-btn-ghost"
                    disabled={busy}
                    onClick={() => void handleUnmute(email)}
                  >
                    Show again
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div className="cy-inbox-error" role="alert">
          {error}
        </div>
      )}

      <div className="cy-inbox-body">
        <aside className="cy-inbox-filters" aria-label="Email categories">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`cy-inbox-filter${filter === f.key ? ' is-active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              <span>{f.label}</span>
              <span className="cy-inbox-count">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </aside>

        <div className="cy-inbox-list-wrap">
          <div className="cy-inbox-bulk-bar">
            <label className="cy-inbox-check-all">
              <input
                type="checkbox"
                checked={allChecked}
                disabled={messages.length === 0}
                onChange={toggleCheckAll}
                aria-label="Select all messages in this view"
              />
              <span>{someChecked ? `${checkedIds.size} selected` : 'Select'}</span>
            </label>
            <div className="cy-inbox-bulk-actions">
              <button
                type="button"
                className="cy-btn"
                disabled={!someChecked || busy}
                onClick={() => void handleBulkArchive(filter !== 'archived')}
              >
                <Archive size={14} aria-hidden />
                {filter === 'archived' ? 'Unarchive' : 'Archive'}
              </button>
              <button
                type="button"
                className="cy-btn"
                disabled={!someChecked || busy}
                onClick={() => void handleBulkDelete()}
              >
                <Trash2 size={14} aria-hidden />
                Delete
              </button>
            </div>
          </div>

          <div className="cy-inbox-list" aria-label="Messages">
            {loading ? (
              <div className="cy-inbox-empty">Loading…</div>
            ) : messages.length === 0 ? (
              <div className="cy-inbox-empty">
                {status?.connected
                  ? 'No messages in this view. Try Sync now.'
                  : 'Connect Gmail in Settings to pull mail into PropOS.'}
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`cy-inbox-row${selectedId === m.id ? ' is-selected' : ''}${m.isUnread ? ' is-unread' : ''}`}
                >
                  <label className="cy-inbox-row-check">
                    <input
                      type="checkbox"
                      checked={checkedIds.has(m.id)}
                      onChange={() => toggleChecked(m.id)}
                      aria-label={`Select ${m.subject || 'message'}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                  <button
                    type="button"
                    className="cy-inbox-row-main"
                    onClick={() => handleSelect(m)}
                  >
                    <div className="cy-inbox-row-top">
                      <span className="cy-inbox-from">
                        {m.fromName || m.fromEmail || 'Unknown sender'}
                      </span>
                      <span className="cy-inbox-when">{formatWhen(m.receivedAt)}</span>
                    </div>
                    <div className="cy-inbox-subject">{m.subject || '(no subject)'}</div>
                    <div className="cy-inbox-snippet">{m.snippet}</div>
                    <div className="cy-inbox-chips">
                      <span className="cy-inbox-chip">{categoryLabel(m.category)}</span>
                      {m.matchedPropertyLabel && (
                        <span
                          className="cy-inbox-chip cy-inbox-chip--prop"
                          title={m.matchedPropertyFullLabel ?? m.matchedPropertyLabel}
                        >
                          {m.matchedPropertyLabel}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="cy-inbox-archive-btn"
                    title={m.isArchived ? 'Unarchive' : 'Archive'}
                    aria-label={m.isArchived ? 'Unarchive message' : 'Archive message'}
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleArchive(m.id, !m.isArchived)
                    }}
                  >
                    {m.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="cy-inbox-detail" aria-label="Message detail">
          {!selected ? (
            <div className="cy-inbox-empty">Select a message</div>
          ) : (
            <>
              <div className="cy-inbox-detail-head">
                <h2>{selected.subject || '(no subject)'}</h2>
                <div className="cy-inbox-detail-meta">
                  <div>
                    <strong>{selected.fromName || selected.fromEmail}</strong>
                    {selected.fromEmail && selected.fromName ? (
                      <span className="cy-inbox-dim"> &lt;{selected.fromEmail}&gt;</span>
                    ) : null}
                  </div>
                  <div className="cy-inbox-dim">{new Date(selected.receivedAt).toLocaleString()}</div>
                </div>
                <div className="cy-inbox-chips">
                  <span className="cy-inbox-chip">{categoryLabel(selected.category)}</span>
                  {selected.matchedPersonName && (
                    <span className="cy-inbox-chip">{selected.matchedPersonName}</span>
                  )}
                  {selected.matchedPropertyLabel && (
                    <span
                      className="cy-inbox-chip cy-inbox-chip--prop"
                      title={
                        selected.matchedPropertyFullLabel ?? selected.matchedPropertyLabel
                      }
                    >
                      {selected.matchedPropertyLabel}
                    </span>
                  )}
                  {selected.categoryConfidence != null && (
                    <span className="cy-inbox-chip cy-inbox-dim">
                      {Math.round(selected.categoryConfidence * 100)}% · {selected.classifiedBy}
                    </span>
                  )}
                </div>
                <div className="cy-inbox-detail-actions">
                  <label className="cy-inbox-recat">
                    <span>Move to</span>
                    <select
                      value={selected.category}
                      onChange={(e) => handleRecategorize(e.target.value as EmailCategory)}
                    >
                      {EMAIL_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {categoryLabel(c)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="cy-inbox-recat cy-inbox-property-link">
                    <span>Property</span>
                    <InboxPropertyCombobox
                      options={propertyOptions}
                      value={selectedPropertyValue}
                      disabled={busy || !selected.fromEmail}
                      title={
                        selected.fromEmail
                          ? 'Tag this sender so future emails get this property'
                          : 'No sender email to link'
                      }
                      onChange={(next) => void handleLinkProperty(next)}
                    />
                  </label>
                  <button
                    type="button"
                    className="cy-btn"
                    disabled={busy}
                    onClick={() => void handleArchive(selected.id, !selected.isArchived)}
                  >
                    {selected.isArchived ? (
                      <>
                        <ArchiveRestore size={14} aria-hidden /> Unarchive
                      </>
                    ) : (
                      <>
                        <Archive size={14} aria-hidden /> Archive
                      </>
                    )}
                  </button>
                  {selected.fromEmail && (
                    <button
                      type="button"
                      className="cy-btn"
                      disabled={busy}
                      title="Hide all mail from this sender"
                      onClick={() => void handleMuteSender(selected.fromEmail)}
                    >
                      <Ban size={14} aria-hidden /> Hide sender
                    </button>
                  )}
                  <button
                    type="button"
                    className="cy-btn"
                    disabled={busy}
                    onClick={() => {
                      if (
                        !window.confirm(
                          'Delete this message from PropOS? It will not be deleted in Gmail.',
                        )
                      ) {
                        return
                      }
                      void (async () => {
                        setBusy(true)
                        const result = await bulkDeleteInboxMessages([selected.id])
                        setBusy(false)
                        if (!result.success) setError(result.error)
                        else await refresh(filter)
                      })()
                    }}
                  >
                    <Trash2 size={14} aria-hidden /> Delete
                  </button>
                  <a
                    className="cy-btn-ghost"
                    href={gmailPermalink(selected.gmailMessageId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Gmail
                  </a>
                </div>
              </div>
              <pre className="cy-inbox-body-text">
                {selected.bodyText?.trim() || selected.snippet || '(No body text)'}
              </pre>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
