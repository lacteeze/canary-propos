'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  createOrgTask,
  deleteOrgTask,
  syncGoogleTasks,
  updateOrgTask,
} from '@/app/actions/org-tasks'
import type {
  CanaryOrgTask,
  CanaryPerson,
  CanaryProperty,
  OrgTaskPriority,
  OrgTaskStatus,
} from '@/lib/canary/types'

const MONO = "var(--font-instrument-sans), 'Instrument Sans', system-ui, sans-serif"

const STATUS_COLS: { key: OrgTaskStatus; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'doing', label: 'Doing' },
  { key: 'done', label: 'Done' },
]

const PRIORITIES: OrgTaskPriority[] = ['low', 'medium', 'high', 'urgent']

function priorityColor(p: OrgTaskPriority): string {
  if (p === 'urgent') return 'var(--red)'
  if (p === 'high') return 'var(--amber)'
  if (p === 'medium') return 'var(--text)'
  return 'var(--dim)'
}

function shortAddr(address: string): string {
  const part = address.split(',')[0]?.trim() || address
  return part.length > 36 ? part.slice(0, 34) + '…' : part
}

type Props = {
  tasks: CanaryOrgTask[]
  people: CanaryPerson[]
  properties: CanaryProperty[]
  userPersonId: string
  /** Staff can create/delete/assign; assignees can complete. */
  canManage: boolean
  googleTasksConnected: boolean
  isVendor: boolean
  searchQuery?: string
}

export default function TeamTasksBoard({
  tasks: initialTasks,
  people,
  properties,
  userPersonId,
  canManage,
  googleTasksConnected,
  isVendor,
  searchQuery = '',
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tasks, setTasks] = useState(initialTasks)
  const [statusFilter, setStatusFilter] = useState<OrgTaskStatus | ''>('')
  const [sharedOnly, setSharedOnly] = useState(isVendor)
  const [composerOpen, setComposerOpen] = useState(false)
  const [editing, setEditing] = useState<CanaryOrgTask | null>(null)
  const [syncing, setSyncing] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'todo' as OrgTaskStatus,
    priority: 'medium' as OrgTaskPriority,
    dueDate: '',
    assigneePersonId: '',
    propertyId: '',
  })

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  const q = searchQuery.trim().toLowerCase()

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false
      if (sharedOnly && t.assigneePersonId !== userPersonId) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.assigneeName.toLowerCase().includes(q) ||
        t.property.toLowerCase().includes(q)
      )
    })
  }, [tasks, statusFilter, sharedOnly, userPersonId, q])

  const counts = useMemo(() => {
    const c: Record<string, number> = { todo: 0, doing: 0, done: 0 }
    for (const t of tasks) {
      if (sharedOnly && t.assigneePersonId !== userPersonId) continue
      c[t.status] = (c[t.status] || 0) + 1
    }
    return c
  }, [tasks, sharedOnly, userPersonId])

  const assignablePeople = useMemo(
    () =>
      people.filter(
        (p) =>
          p.status !== 'Inactive' &&
          (p.roles?.some((r) =>
            ['manager', 'admin', 'employee', 'vendor', 'owner'].includes(r),
          ) ||
            ['Manager', 'Admin', 'Vendor', 'Owner', 'Employee'].includes(p.role)),
      ),
    [people],
  )

  function resetForm() {
    setForm({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: '',
      assigneePersonId: '',
      propertyId: '',
    })
  }

  function openCreate() {
    resetForm()
    setEditing(null)
    setComposerOpen(true)
  }

  function openEdit(t: CanaryOrgTask) {
    setEditing(t)
    setForm({
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate || '',
      assigneePersonId: t.assigneePersonId || '',
      propertyId: t.propertyId || '',
    })
    setComposerOpen(true)
  }

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Title is required.')
      return
    }

    if (editing) {
      const result = await updateOrgTask({
        id: editing.id,
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
        assigneePersonId: form.assigneePersonId || null,
        propertyId: form.propertyId || null,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      if (result.data?.task) {
        setTasks((prev) =>
          prev.map((t) => (t.id === editing.id ? { ...t, ...result.data!.task } : t)),
        )
      }
      toast.success('Task updated.')
    } else {
      const result = await createOrgTask({
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
        assigneePersonId: form.assigneePersonId || null,
        propertyId: form.propertyId || null,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      if (result.data?.task) {
        setTasks((prev) => [result.data!.task, ...prev])
      }
      toast.success('Task created.')
    }
    setComposerOpen(false)
    setEditing(null)
    resetForm()
    refresh()
  }

  async function handleStatusChange(task: CanaryOrgTask, status: OrgTaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)))
    const result = await updateOrgTask({ id: task.id, status })
    if (!result.success) {
      toast.error(result.error)
      setTasks(initialTasks)
      return
    }
    refresh()
  }

  async function handleDelete(task: CanaryOrgTask) {
    if (!canManage) return
    if (!window.confirm(`Delete “${task.title}”?`)) return
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    const result = await deleteOrgTask(task.id)
    if (!result.success) {
      toast.error(result.error)
      setTasks(initialTasks)
      return
    }
    toast.success('Task deleted.')
    refresh()
  }

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    try {
      const result = await syncGoogleTasks()
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const { imported = 0, updated = 0 } = result.data ?? {}
      toast.success(`Imported ${imported}, updated ${updated} from Google Tasks.`)
      refresh()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      <div className="cy-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          className={`cy-pill${!statusFilter ? ' cy-pill--active' : ''}`}
          onClick={() => setStatusFilter('')}
        >
          All{' '}
          <span style={{ opacity: 0.6, fontFamily: MONO, fontSize: 11 }}>
            {String(
              sharedOnly
                ? tasks.filter((t) => t.assigneePersonId === userPersonId).length
                : tasks.length,
            )}
          </span>
        </button>
        {STATUS_COLS.map((col) => (
          <button
            key={col.key}
            type="button"
            className={`cy-pill${statusFilter === col.key ? ' cy-pill--active' : ''}`}
            onClick={() => setStatusFilter(col.key)}
          >
            {col.label}{' '}
            <span style={{ opacity: 0.6, fontFamily: MONO, fontSize: 11 }}>
              {String(counts[col.key] || 0)}
            </span>
          </button>
        ))}
        {!isVendor && (
          <button
            type="button"
            className={`cy-pill${sharedOnly ? ' cy-pill--active' : ''}`}
            onClick={() => setSharedOnly((v) => !v)}
          >
            Shared to me
          </button>
        )}

        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canManage && googleTasksConnected && (
            <button
              type="button"
              className="cy-btn"
              disabled={syncing || pending}
              onClick={() => void handleSync()}
            >
              {syncing ? 'Syncing…' : 'Import from Google Tasks'}
            </button>
          )}
          {canManage && !googleTasksConnected && (
            <a href="/settings" className="cy-btn">
              Connect Google Tasks
            </a>
          )}
          {canManage && (
            <button type="button" className="cy-btn cy-btn--active" onClick={openCreate}>
              Add task
            </button>
          )}
        </span>
      </div>

      {filtered.length === 0 && !composerOpen && (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '40px 28px',
            textAlign: 'center',
            maxWidth: 520,
            margin: '12px auto 0',
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>
            {isVendor ? 'No tasks shared with you' : 'No team tasks yet'}
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.5, color: 'var(--dim)' }}>
            {isVendor
              ? 'When a manager assigns you a task, it will show up here.'
              : 'Create a task for your team, or connect Google Tasks in Settings to import incomplete items.'}
          </p>
          {canManage && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="cy-btn cy-btn--active" onClick={openCreate}>
                Add task
              </button>
              {!googleTasksConnected && (
                <a href="/settings" className="cy-btn">
                  Connect Google Tasks
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {(filtered.length > 0 || statusFilter) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
            marginTop: 8,
          }}
        >
          {STATUS_COLS.filter((c) => !statusFilter || statusFilter === c.key).map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.key)
            return (
              <div
                key={col.key}
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 12,
                  minHeight: 120,
                }}
              >
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    color: 'var(--dim)',
                    marginBottom: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{col.label}</span>
                  <span>{colTasks.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      className="cy-hov-border"
                      style={{
                        background: 'var(--elev)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: '12px 12px',
                        cursor: 'pointer',
                      }}
                      onClick={() => openEdit(t)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openEdit(t)
                        }
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ fontWeight: 700, minWidth: 0 }}>{t.title}</div>
                        <span
                          style={{
                            flex: 'none',
                            fontSize: 11,
                            fontWeight: 700,
                            color: priorityColor(t.priority),
                          }}
                        >
                          {t.priority}
                        </span>
                      </div>
                      <div style={{ color: 'var(--dim)', fontSize: '12.5px', marginBottom: 6 }}>
                        {[
                          t.assigneeName || 'Unassigned',
                          t.dueDate || null,
                          t.property ? shortAddr(t.property) : null,
                          t.source === 'google' ? 'Google' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {t.description ? (
                        <div
                          style={{
                            color: 'var(--dim)',
                            fontSize: 13,
                            maxHeight: 44,
                            overflow: 'hidden',
                          }}
                        >
                          {t.description.slice(0, 140)}
                        </div>
                      ) : null}
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          marginTop: 10,
                          flexWrap: 'wrap',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {STATUS_COLS.filter((s) => s.key !== t.status).map((s) => (
                          <button
                            key={s.key}
                            type="button"
                            className="cy-btn"
                            style={{ fontSize: 12, padding: '4px 8px' }}
                            onClick={() => void handleStatusChange(t, s.key)}
                          >
                            → {s.label}
                          </button>
                        ))}
                        {canManage && (
                          <button
                            type="button"
                            className="cy-btn"
                            style={{ fontSize: 12, padding: '4px 8px', marginLeft: 'auto' }}
                            onClick={() => void handleDelete(t)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!colTasks.length && (
                    <div style={{ color: 'var(--faint)', fontSize: 13, padding: '8px 4px' }}>
                      Empty
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {composerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.35)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => {
            setComposerOpen(false)
            setEditing(null)
          }}
        >
          <div
            className="cy-section-card"
            style={{
              width: 'min(480px, 100%)',
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 20,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>
              {editing ? 'Edit task' : 'New task'}
            </h2>
            <label className="cy-label" htmlFor="org-task-title">
              Title
            </label>
            <input
              id="org-task-title"
              className="cy-input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              disabled={!canManage && !!editing}
              style={{ width: '100%', marginBottom: 10 }}
            />
            <label className="cy-label" htmlFor="org-task-desc">
              Description
            </label>
            <textarea
              id="org-task-desc"
              className="cy-input"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              disabled={!canManage && !!editing}
              style={{ width: '100%', marginBottom: 10, resize: 'vertical' }}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div>
                <label className="cy-label" htmlFor="org-task-status">
                  Status
                </label>
                <select
                  id="org-task-status"
                  className="cy-input"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as OrgTaskStatus }))
                  }
                  style={{ width: '100%' }}
                >
                  {STATUS_COLS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="cy-label" htmlFor="org-task-priority">
                  Priority
                </label>
                <select
                  id="org-task-priority"
                  className="cy-input"
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: e.target.value as OrgTaskPriority }))
                  }
                  disabled={!canManage && !!editing}
                  style={{ width: '100%' }}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {canManage && (
              <>
                <label className="cy-label" htmlFor="org-task-due">
                  Due date
                </label>
                <input
                  id="org-task-due"
                  type="date"
                  className="cy-input"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  style={{ width: '100%', marginBottom: 10 }}
                />
                <label className="cy-label" htmlFor="org-task-assignee">
                  Assignee
                </label>
                <select
                  id="org-task-assignee"
                  className="cy-input"
                  value={form.assigneePersonId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assigneePersonId: e.target.value }))
                  }
                  style={{ width: '100%', marginBottom: 10 }}
                >
                  <option value="">Unassigned</option>
                  {assignablePeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.id === userPersonId ? ' (me)' : ''}
                    </option>
                  ))}
                </select>
                <label className="cy-label" htmlFor="org-task-property">
                  Property (optional)
                </label>
                <select
                  id="org-task-property"
                  className="cy-input"
                  value={form.propertyId}
                  onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
                  style={{ width: '100%', marginBottom: 10 }}
                >
                  <option value="">None</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {shortAddr(p.address)}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                className="cy-btn"
                onClick={() => {
                  setComposerOpen(false)
                  setEditing(null)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cy-btn cy-btn--active"
                onClick={() => void handleSave()}
              >
                {editing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
