'use client'

import React, { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateLeaseField,
  updatePersonField,
  updatePortfolioField,
  updateProjectField,
  updatePropertyField,
} from '@/app/actions/entity-updates'
import { getOrCreatePropertyThread, getThreadMessages, sendChatMessage, type ChatMessage } from '@/app/actions/chat'
import type { CanaryDb, CanaryPerson } from '@/lib/canary/types'
import AuditLogPanel from './AuditLogPanel'

const MONO = "'IBM Plex Mono', monospace"

export type DrawerKind = 'lease' | 'property' | 'person' | 'portfolio' | 'project'
export type DrawerState = { kind: DrawerKind; id: string } | null

interface EntityDetailDrawerProps {
  drawer: DrawerState
  onClose: () => void
  db: CanaryDb
  canEdit: boolean
  priv: boolean
  peopleById: Map<string, CanaryPerson>
  onNavigate: (d: { kind: DrawerKind; id: string }) => void
  actions?: { label: string; onClick: () => void }[]
  tenantNames: (info: string | null | undefined) => string
  short: (addr: string | null | undefined) => string
  money: (n: number | null | undefined) => string
  onOpenMessages?: (threadId: string) => void
}

const PROPERTY_STATUSES = ['Vacant', 'Leased', 'Maintenance']
const LEASE_RENEWAL = ['—', 'pending', 'sent', 'accepted', 'declined']
const LEASE_DB_STATUS = ['active', 'expired', 'terminated']
const PROJECT_STATUSES = ['Estimate', 'Requires Estimate', 'Reviewing Estimates', 'Approved to Schedule', 'In Progress', 'Completed', 'Closed', 'Postponed', 'Cancelled']
const PROJECT_PRIORITIES = ['1 - Urgent', '2 - High', '3 - Medium', '4 - Low']

function StatusSelect({
  value,
  options,
  onSave,
  disabled,
}: {
  value: string
  options: string[]
  onSave: (v: string) => Promise<{ success: boolean; error?: string }>
  disabled?: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  if (disabled) return <span style={{ fontWeight: 600 }}>{value || '—'}</span>

  return (
    <span>
      <select
        value={value || options[0]}
        disabled={saving}
        onChange={async (e) => {
          setSaving(true)
          setErr('')
          const res = await onSave(e.target.value)
          if (!res.success) setErr(res.error ?? 'Failed')
          setSaving(false)
        }}
        style={{ background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 8px', fontWeight: 600, fontSize: 13 }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      {err && <span style={{ color: 'var(--red)', fontSize: 11, marginLeft: 6 }}>{err}</span>}
    </span>
  )
}

function InlineField({
  value,
  label,
  onSave,
  type = 'text',
  disabled,
  confirm,
}: {
  value: string
  label: string
  onSave: (v: string) => Promise<{ success: boolean; error?: string }>
  type?: 'text' | 'date' | 'textarea' | 'number'
  disabled?: boolean
  confirm?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  if (disabled) {
    return <span style={{ fontWeight: 600, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value || '—'}</span>
  }

  if (!editing) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <span style={{ fontWeight: 600, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value || '—'}</span>
        <button
          type="button"
          onClick={() => { setDraft(value); setEditing(true); setErr('') }}
          style={{ border: '1px solid var(--border)', background: 'var(--elev)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--dim)', flex: 'none' }}
        >
          Edit
        </button>
      </span>
    )
  }

  const save = async () => {
    if (confirm && !window.confirm(`Save changes to ${label}?`)) return
    setSaving(true)
    setErr('')
    const res = await onSave(draft)
    setSaving(false)
    if (res.success) setEditing(false)
    else setErr(res.error ?? 'Failed')
  }

  const InputEl = type === 'textarea' ? 'textarea' : 'input'

  return (
    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <InputEl
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        {...({ value: draft, onChange: (e: any) => setDraft(e.target.value), type: type === 'textarea' ? undefined : type } as any)}
        rows={type === 'textarea' ? 3 : undefined}
        style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', fontWeight: 600, fontSize: 13, resize: type === 'textarea' ? 'vertical' : undefined }}
      />
      <span style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={save} disabled={saving} style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 6, padding: '4px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Save</button>
        <button type="button" onClick={() => setEditing(false)} style={{ border: '1px solid var(--border)', background: 'var(--elev)', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--dim)' }}>Cancel</button>
      </span>
      {err && <span style={{ color: 'var(--red)', fontSize: 11 }}>{err}</span>}
    </span>
  )
}

function PropertyChatSection({
  propertyDbId,
  canEdit,
  onOpenMessages,
}: {
  propertyDbId: string
  canEdit: boolean
  onOpenMessages?: (threadId: string) => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState(false)

  const init = useCallback(async () => {
    const res = await getOrCreatePropertyThread(propertyDbId)
    if (res.success && res.data) {
      setThreadId(res.data.threadId)
      const msgs = await getThreadMessages(res.data.threadId)
      setMessages(msgs)
    }
  }, [propertyDbId])

  React.useEffect(() => {
    if (expanded && !threadId) init()
  }, [expanded, threadId, init])

  const send = () => {
    if (!threadId || !input.trim()) return
    const body = input.trim()
    setInput('')
    startTransition(async () => {
      await sendChatMessage(threadId, body)
      setMessages(await getThreadMessages(threadId))
      router.refresh()
    })
  }

  if (!canEdit) return null

  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, fontSize: 13, padding: 0 }}
      >
        {expanded ? '▾ Property chat' : '▸ Property chat'}
      </button>
      {expanded && (
        <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ maxHeight: 180, overflowY: 'auto', padding: 10, background: 'var(--elev)' }}>
            {messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: m.isOwn ? 'var(--accent)' : 'var(--text)' }}>{m.authorName}: </span>
                {m.body}
              </div>
            ))}
            {!messages.length && <div style={{ color: 'var(--dim)', fontSize: 12 }}>No messages — start the conversation.</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid var(--border)' }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Message team…" style={{ flex: 1, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }} />
            <button type="button" onClick={send} style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}>Send</button>
          </div>
          {threadId && onOpenMessages && (
            <button type="button" onClick={() => onOpenMessages(threadId)} style={{ width: '100%', border: 'none', borderTop: '1px solid var(--border)', background: 'var(--panel)', padding: 8, cursor: 'pointer', color: 'var(--dim)', fontSize: 12 }}>
              Open in Messages →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

type RowDef = { label: string; value: React.ReactNode; onClick?: () => void }

function Section({ title, rows }: { title: string; rows: RowDef[] }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>{title}</div>
      {rows.map((dr, ri) => (
        <div key={ri} className={dr.onClick ? 'cy-hov' : undefined} onClick={dr.onClick} style={{ display: 'flex', gap: 12, padding: '8px 4px', fontSize: '13.5px', borderRadius: 7, cursor: dr.onClick ? 'pointer' : 'default', alignItems: 'flex-start' }}>
          <span style={{ flex: '0 0 128px', color: 'var(--dim)' }}>{dr.label}</span>
          <span style={{ flex: 1, minWidth: 0 }}>{dr.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function EntityDetailDrawer({
  drawer,
  onClose,
  db,
  canEdit,
  priv,
  peopleById,
  onNavigate,
  actions = [],
  tenantNames,
  short,
  money,
  onOpenMessages,
}: EntityDetailDrawerProps) {
  const router = useRouter()
  const [auditKey, setAuditKey] = useState(0)

  const refresh = () => {
    setAuditKey((k) => k + 1)
    router.refresh()
  }

  const wrapSave = (fn: (v: string) => Promise<{ success: boolean; error?: string }>) =>
    async (v: string) => {
      const res = await fn(v)
      if (res.success) refresh()
      return res
    }

  if (!drawer) return null

  let title = ''
  let sub = ''
  let kindLabel = ''
  let auditTable = ''
  let auditId = drawer.id
  let sections: React.ReactNode[] = []
  let found = true

  if (drawer.kind === 'lease') {
    const l = db.leases.find((x) => x.id === drawer.id)
    auditTable = 'leases'
    if (!l) found = false
    else {
      title = short(l.property)
      sub = l.property
      kindLabel = 'Lease · ' + (l.status || '')
      sections = [
        <Section
          key="details"
          title="Lease details"
          rows={[
            {
              label: 'Status (DB)',
              value: canEdit ? (
                <StatusSelect value={l.status === 'Past' ? 'expired' : 'active'} options={LEASE_DB_STATUS} onSave={wrapSave((v) => updateLeaseField(l.id, 'status', v))} />
              ) : l.status,
            },
            {
              label: 'Renewal',
              value: canEdit ? (
                <StatusSelect value={l.renewal || '—'} options={LEASE_RENEWAL} onSave={wrapSave((v) => updateLeaseField(l.id, 'renewal_status', v === '—' ? '' : v))} />
              ) : (l.renewal || '—'),
            },
            {
              label: 'Rent',
              value: <InlineField value={l.rent} label="rent" confirm onSave={wrapSave((v) => updateLeaseField(l.id, 'monthly_rent', v))} disabled={!canEdit} />,
            },
            {
              label: 'Deposit',
              value: <InlineField value={l.deposit} label="deposit" confirm onSave={wrapSave((v) => updateLeaseField(l.id, 'deposit_amount', v))} disabled={!canEdit} />,
            },
            {
              label: 'Start',
              value: <InlineField value={l.start} label="start date" type="date" confirm onSave={wrapSave((v) => updateLeaseField(l.id, 'start_date', v))} disabled={!canEdit} />,
            },
            {
              label: 'End',
              value: <InlineField value={l.end} label="end date" type="date" confirm onSave={wrapSave((v) => updateLeaseField(l.id, 'end_date', v))} disabled={!canEdit} />,
            },
            { label: 'Months', value: l.months || '—' },
          ]}
        />,
        <Section
          key="tenants"
          title="Tenants"
          rows={(tenantNames(l.tenantInfo) ? tenantNames(l.tenantInfo).split(', ') : []).map((n) => ({
            label: '•',
            value: priv ? (l.tenantInfo.split(',').find((s) => s.includes(n)) || n).trim() : n,
          })).concat(tenantNames(l.tenantInfo) ? [] : [{ label: '', value: 'No tenants on record' }])}
        />,
      ]
      const related = db.projects.filter((j) => j.property === l.property)
      if (related.length) {
        sections.push(
          <Section
            key="projects"
            title="Tasks & projects at property"
            rows={related.map((j) => ({ label: j.status || '—', value: j.name, onClick: () => onNavigate({ kind: 'project', id: j.id }) }))}
          />
        )
      }
    }
  }

  if (drawer.kind === 'property') {
    const p = db.properties.find((x) => x.id === drawer.id)
    auditTable = 'units'
    if (!p) found = false
    else {
      title = short(p.address)
      sub = p.address
      kindLabel = 'Property · ' + (p.status || '')
      sections = [
        <Section
          key="overview"
          title="Overview"
          rows={[
            {
              label: 'Status',
              value: canEdit ? (
                <StatusSelect value={p.status || 'Vacant'} options={PROPERTY_STATUSES} onSave={wrapSave((v) => updatePropertyField(p.id, 'status', v))} />
              ) : (p.status || '—'),
            },
            { label: 'Type', value: p.type || '—' },
            { label: 'Area', value: [p.city, p.area].filter(Boolean).join(' · ') || '—' },
            {
              label: 'Beds / Baths',
              value: canEdit ? (
                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <InlineField value={p.beds} label="bedrooms" type="number" onSave={wrapSave((v) => updatePropertyField(p.id, 'bedrooms', v))} />
                  <span>/</span>
                  <InlineField value={p.baths} label="bathrooms" type="number" onSave={wrapSave((v) => updatePropertyField(p.id, 'bathrooms', v))} />
                </span>
              ) : [p.beds, p.baths].map((x) => x || '—').join(' / '),
            },
            {
              label: 'Asking rate',
              value: canEdit ? (
                <InlineField value={p.rate != null ? String(p.rate) : ''} label="asking rate" type="number" confirm onSave={wrapSave((v) => updatePropertyField(p.id, 'asking_rent', v))} />
              ) : (p.rate ? money(p.rate) + '/mo' : '—'),
            },
            { label: 'Pets', value: p.petFriendly || '—' },
          ]}
        />,
      ]
      if (priv) {
        sections.push(
          <Section
            key="private"
            title="🔒 Private — staff only"
            rows={[
              { label: 'Portfolio', value: p.portfolioId ? db.portfolios.find((pf) => pf.id === p.portfolioId)?.name ?? '—' : '—' },
              { label: 'Owner', value: peopleById.get(p.ownerId)?.name ?? '—' },
              { label: 'Management fee', value: p.mgmtFee || '—' },
            ]}
          />
        )
      }
      if (p.propertyDbId) {
        sections.push(
          <PropertyChatSection key="chat" propertyDbId={p.propertyDbId} canEdit={canEdit} onOpenMessages={onOpenMessages} />
        )
      }
      const hist = db.leases.filter((l) => l.property === p.address).sort((a, b) => (b.start || '').localeCompare(a.start || ''))
      sections.push(
        <Section
          key="leases"
          title={`Lease history (${hist.length})`}
          rows={hist.slice(0, 10).map((l) => ({
            label: l.status || '—',
            value: `${l.start || '?'} → ${l.end || '?'} · ${l.rent || ''}${tenantNames(l.tenantInfo) ? ' · ' + tenantNames(l.tenantInfo) : ''}`,
            onClick: () => onNavigate({ kind: 'lease', id: l.id }),
          }))}
        />
      )
      const related = db.projects.filter((j) => j.property === p.address)
      if (related.length) {
        sections.push(
          <Section key="proj" title="Open projects" rows={related.map((j) => ({ label: j.status || '—', value: j.name, onClick: () => onNavigate({ kind: 'project', id: j.id }) }))} />
        )
      }
    }
  }

  if (drawer.kind === 'person') {
    const p = db.people.find((x) => x.id === drawer.id)
    auditTable = 'people'
    if (!p) found = false
    else {
      title = p.name
      sub = p.company && p.company !== p.name ? p.company : ''
      kindLabel = p.role || 'Person'
      sections = [
        <Section
          key="contact"
          title="Contact"
          rows={[
            { label: 'Email', value: <InlineField value={p.email} label="email" confirm onSave={wrapSave((v) => updatePersonField(p.id, 'email', v))} disabled={!canEdit} /> },
            { label: 'Phone', value: <InlineField value={p.phone} label="phone" onSave={wrapSave((v) => updatePersonField(p.id, 'phone', v))} disabled={!canEdit} /> },
            {
              label: 'Status',
              value: canEdit ? (
                <StatusSelect value={p.status || 'Active'} options={['Active', 'Inactive', 'Prospect']} onSave={wrapSave((v) => updatePersonField(p.id, 'status', v))} />
              ) : (p.status || '—'),
            },
            ...(p.company ? [{ label: 'Company', value: <InlineField value={p.company} label="company" onSave={wrapSave((v) => updatePersonField(p.id, 'company', v))} disabled={!canEdit} /> }] : []),
            ...(p.address ? [{ label: 'Mailing address', value: <InlineField value={p.address} label="address" onSave={wrapSave((v) => updatePersonField(p.id, 'mailing_address', v))} disabled={!canEdit} /> }] : []),
            ...(p.website ? [{ label: 'Website', value: <InlineField value={p.website} label="website" onSave={wrapSave((v) => updatePersonField(p.id, 'website', v))} disabled={!canEdit} /> }] : []),
            ...(p.services ? [{ label: 'Services', value: <InlineField value={p.services} label="services" type="textarea" onSave={wrapSave((v) => updatePersonField(p.id, 'services', v))} disabled={!canEdit} /> }] : []),
            ...(p.rating ? [{ label: 'Rating', value: p.rating + ' / 5' }] : []),
          ]}
        />,
      ]
      if (p.notes) {
        sections.push(
          <Section key="notes" title="Notes" rows={[{ label: '', value: <InlineField value={p.notes} label="notes" type="textarea" onSave={wrapSave((v) => updatePersonField(p.id, 'notes', v))} disabled={!canEdit} /> }]} />
        )
      }
      if (p.role === 'Tenant') {
        const prefs = [
          p.minBeds ? { label: 'Min bedrooms', value: p.minBeds } : null,
          p.minBaths ? { label: 'Min bathrooms', value: p.minBaths } : null,
          p.minParking ? { label: 'Min parking', value: p.minParking } : null,
          p.pets ? { label: 'Pets', value: p.pets } : null,
          p.moveIn ? { label: 'Move-in date', value: p.moveIn } : null,
          p.leaseType ? { label: 'Lease type', value: p.leaseType } : null,
          p.maxPrice ? { label: 'Max price', value: money(parseFloat(p.maxPrice)) + '/mo' } : null,
        ].filter(Boolean) as RowDef[]
        if (prefs.length) sections.push(<Section key="prefs" title="Looking for" rows={prefs} />)
        const theirs = db.leases.filter((l) => (l.tenantIds || '').includes(p.id))
        if (theirs.length) {
          sections.push(
            <Section key="leases" title="Leases" rows={theirs.map((l) => ({ label: l.status || '—', value: `${short(l.property)} · ${l.start || ''} → ${l.end || ''}`, onClick: () => onNavigate({ kind: 'lease', id: l.id }) }))} />
          )
        }
      }
      if (p.role === 'Client') {
        const pfs = db.portfolios.filter((pf) => (pf.ownerIds || '').includes(p.id))
        if (pfs.length) {
          sections.push(
            <Section key="pfs" title="Portfolios" rows={pfs.map((pf) => ({ label: pf.status || '—', value: pf.name, onClick: () => onNavigate({ kind: 'portfolio', id: pf.id }) }))} />
          )
        }
        const owned = db.properties.filter((x) => x.ownerId === p.id)
        if (owned.length) {
          sections.push(
            <Section key="owned" title={`Properties (${owned.length})`} rows={owned.slice(0, 12).map((x) => ({ label: x.status || '—', value: short(x.address), onClick: () => onNavigate({ kind: 'property', id: x.id }) }))} />
          )
        }
      }
    }
  }

  if (drawer.kind === 'portfolio') {
    const pf = db.portfolios.find((x) => x.id === drawer.id)
    auditTable = 'portfolios'
    if (!pf) found = false
    else {
      title = pf.name
      kindLabel = 'Portfolio · ' + (pf.status || '')
      const owners = (pf.ownerIds || '').split(',').map((s) => s.trim()).filter(Boolean).map((i) => peopleById.get(i)).filter(Boolean) as CanaryPerson[]
      sub = owners.map((o) => o.name).join(', ')
      sections = [
        <Section
          key="terms"
          title="Terms"
          rows={[
            { label: 'Status', value: pf.status || '—' },
            { label: 'Name', value: <InlineField value={pf.name} label="portfolio name" confirm onSave={wrapSave((v) => updatePortfolioField(pf.id, 'name', v))} disabled={!canEdit} /> },
            { label: 'Start date', value: pf.startDate || '—' },
          ]}
        />,
      ]
      if (owners.length) {
        sections.push(
          <Section key="owners" title="Owners" rows={owners.map((o) => ({ label: o.role, value: o.name + (o.email ? ' · ' + o.email : ''), onClick: () => onNavigate({ kind: 'person', id: o.id }) }))} />
        )
      }
      const pprops = db.properties.filter((p) => p.portfolioId === pf.id)
      sections.push(
        <Section key="props" title={`Properties (${pprops.length})`} rows={pprops.map((p) => ({ label: p.status || '—', value: short(p.address), onClick: () => onNavigate({ kind: 'property', id: p.id }) }))} />
      )
    }
  }

  if (drawer.kind === 'project') {
    const j = db.projects.find((x) => x.id === drawer.id)
    auditTable = 'work_orders'
    if (!j) found = false
    else {
      title = j.name || 'Untitled'
      sub = short(j.property)
      kindLabel = 'Project · ' + (j.status || '')
      sections = [
        <Section
          key="main"
          title="Project details"
          rows={[
            {
              label: 'Status',
              value: canEdit ? (
                <StatusSelect value={j.status || PROJECT_STATUSES[0]} options={PROJECT_STATUSES} onSave={wrapSave((v) => updateProjectField(j.id, 'status', v))} />
              ) : (j.status || '—'),
            },
            {
              label: 'Priority',
              value: canEdit ? (
                <StatusSelect value={j.priority || PROJECT_PRIORITIES[2]} options={PROJECT_PRIORITIES} onSave={wrapSave((v) => updateProjectField(j.id, 'priority', v))} />
              ) : (j.priority || '—'),
            },
            { label: 'Property', value: j.property || '—' },
            { label: 'Title', value: <InlineField value={j.name} label="title" confirm onSave={wrapSave((v) => updateProjectField(j.id, 'title', v))} disabled={!canEdit} /> },
            { label: 'Category', value: <InlineField value={j.category} label="category" onSave={wrapSave((v) => updateProjectField(j.id, 'category', v))} disabled={!canEdit} /> },
            { label: 'Estimate', value: <InlineField value={(j.estimate || '').replace(/[$,]/g, '')} label="estimate" type="number" confirm onSave={wrapSave((v) => updateProjectField(j.id, 'estimated_cost', v))} disabled={!canEdit} /> },
            { label: 'Budget', value: <InlineField value={(j.budget || '').replace(/[$,]/g, '')} label="budget" type="number" confirm onSave={wrapSave((v) => updateProjectField(j.id, 'budget', v))} disabled={!canEdit} /> },
            { label: 'Deposit', value: <InlineField value={(j.deposit || '').replace(/[$,]/g, '')} label="deposit" type="number" confirm onSave={wrapSave((v) => updateProjectField(j.id, 'deposit', v))} disabled={!canEdit} /> },
            { label: 'Start date', value: <InlineField value={j.startDate} label="start date" type="date" onSave={wrapSave((v) => updateProjectField(j.id, 'start_date', v))} disabled={!canEdit} /> },
            { label: 'End date', value: <InlineField value={j.endDate} label="end date" type="date" onSave={wrapSave((v) => updateProjectField(j.id, 'end_date', v))} disabled={!canEdit} /> },
            { label: 'Completed date', value: <InlineField value={j.completedDate} label="completed date" type="date" onSave={wrapSave((v) => updateProjectField(j.id, 'completed_date', v))} disabled={!canEdit} /> },
            { label: 'Contractors', value: j.contractors || '—' },
            { label: 'Description', value: <InlineField value={j.description} label="description" type="textarea" onSave={wrapSave((v) => updateProjectField(j.id, 'description', v))} disabled={!canEdit} /> },
            { label: 'Notes', value: <InlineField value={j.notes} label="notes" type="textarea" onSave={wrapSave((v) => updateProjectField(j.id, 'notes', v))} disabled={!canEdit} /> },
          ]}
        />,
      ]
      if (j.propertyDbId) {
        sections.push(
          <PropertyChatSection key="chat" propertyDbId={j.propertyDbId} canEdit={canEdit} onOpenMessages={onOpenMessages} />
        )
      }
    }
  }

  if (!found) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,6,.55)', zIndex: 60, backdropFilter: 'blur(2px)' }} />
      <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(480px,94vw)', background: 'var(--panel)', borderLeft: '1px solid var(--border2)', zIndex: 61, boxShadow: 'var(--shadow)', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>{kindLabel}</div>
            <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-.01em' }}>{title}</div>
            <div style={{ color: 'var(--dim)', fontSize: 13 }}>{sub}</div>
          </div>
          <button type="button" onClick={onClose} style={{ border: '1px solid var(--border)', background: 'var(--elev)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--dim)', flex: 'none' }}>✕</button>
        </div>
        {actions.map((da) => (
          <button key={da.label} type="button" className="cy-accent-btn" onClick={da.onClick} style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 9, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', margin: '6px 8px 6px 0', alignSelf: 'flex-start' }}>{da.label}</button>
        ))}
        <div style={{ flex: 1 }}>{sections}</div>
        {auditTable && <AuditLogPanel key={auditKey} tableName={auditTable} recordId={auditId} canEdit={canEdit} />}
      </aside>
    </>
  )
}
