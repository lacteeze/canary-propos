'use client'

import React, { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createTenantAndLinkToLease,
  deleteLease,
  updateLeaseField,
  updateLeaseTenant,
  updatePersonField,
  updatePortfolioField,
  updateProjectField,
  updatePropertyDetails,
  updatePropertyField,
  type PropertyDetailsInput,
} from '@/app/actions/entity-updates'
import { getOrCreatePropertyThread, getThreadMessages, sendChatMessage, type ChatMessage } from '@/app/actions/chat'
import { LEASE_TERM_LABELS } from '@/lib/canary/lease-term'
import type { CanaryDb, CanaryLease, CanaryPerson, CanaryProperty } from '@/lib/canary/types'
import { leaseDbStatusFromDisplay } from '@/lib/canary/types'
import AuditLogPanel from './AuditLogPanel'
import DatePickerField, { formatDisplayDate } from './DatePickerField'
import { PropertyPhotoUpload } from '@/components/properties/PropertyPhotoUpload'

const MONO = "var(--font-instrument-sans), 'Instrument Sans', system-ui, sans-serif"

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

const PROPERTY_STATUSES = ['Vacant', 'Leased', 'STR', 'Maintenance', 'Office']
const PROPERTY_TYPE_OPTIONS = ['house', 'duplex', 'apartment_building', 'condo', 'townhouse', 'other']

function propertyStatusOption(status: string | null | undefined): string {
  if (!status) return 'Vacant'
  if (status === 'Airbnb') return 'STR'
  return PROPERTY_STATUSES.includes(status) ? status : 'Vacant'
}

function propertyTypeOption(type: string | null | undefined): string {
  const normalized = (type || 'other').trim().replace(/ /g, '_')
  return PROPERTY_TYPE_OPTIONS.includes(normalized) ? normalized : 'other'
}

function formatPropertyTypeLabel(type: string): string {
  return type.replace(/_/g, ' ')
}
const LEASE_RENEWAL = ['—', 'pending', 'sent', 'accepted', 'declined']
const LEASE_DB_STATUS = ['active', 'expired', 'terminated']
const LEASE_TERM_TYPE = ['fixed_term', 'month_to_month']
const PROJECT_STATUSES = ['Estimate', 'Requires Estimate', 'Reviewing Estimates', 'Approved to Schedule', 'In Progress', 'Postponed', 'Completed', 'Cancelled', 'Closed']
const PROJECT_PRIORITIES = ['1 - Urgent', '2 - High', '3 - Medium', '4 - Low']

const LEASE_TENANT_ADD = '__add_new_tenant__'


const miniInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input)',
  border: '1px solid var(--border)',
  borderRadius: 999,
  padding: '5px 10px',
  fontWeight: 600,
  fontSize: 12.5,
}

function LeaseTenantSection({
  lease,
  tenants,
  peopleById,
  canEdit,
  priv,
  tenantNames,
  onNavigate,
  onSaved,
}: {
  lease: CanaryLease
  tenants: CanaryPerson[]
  peopleById: Map<string, CanaryPerson>
  canEdit: boolean
  priv: boolean
  tenantNames: (info: string | null | undefined) => string
  onNavigate: (d: { kind: DrawerKind; id: string }) => void
  onSaved: () => void
}) {
  const linked = lease.tenantIds ? peopleById.get(lease.tenantIds) : undefined
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')

  const sortedTenants = [...tenants].sort((a, b) => a.name.localeCompare(b.name))

  const handleSelect = async (value: string) => {
    if (value === LEASE_TENANT_ADD) {
      setShowAddForm(true)
      setErr('')
      return
    }
    setSaving(true)
    setErr('')
    const res = await updateLeaseTenant(lease.id, value || null)
    setSaving(false)
    if (res.success) {
      setShowAddForm(false)
      onSaved()
    } else {
      setErr(res.error ?? 'Failed')
    }
  }

  const handleCreate = async () => {
    setSaving(true)
    setErr('')
    const res = await createTenantAndLinkToLease(lease.id, {
      name: newName,
      email: newEmail,
      phone: newPhone,
    })
    setSaving(false)
    if (res.success) {
      setShowAddForm(false)
      setNewName('')
      setNewEmail('')
      setNewPhone('')
      onSaved()
    } else {
      setErr(res.error ?? 'Failed')
    }
  }

  const rows: { label: string; value: React.ReactNode; onClick?: () => void }[] = []

  if (canEdit) {
    rows.push({
      label: linked ? 'Change tenant' : 'Link tenant',
      value: (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <select
            className="cy-select cy-select--field"
            value={lease.tenantIds || ''}
            disabled={saving}
            onChange={(e) => handleSelect(e.target.value)}
            aria-label="Select tenant"
          >
            <option value="">— No tenant linked —</option>
            {sortedTenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.email ? ` · ${t.email}` : ''}
              </option>
            ))}
            <option value={LEASE_TENANT_ADD}>+ Add new tenant…</option>
          </select>
          {err && <span style={{ color: 'var(--red)', fontSize: 11 }}>{err}</span>}
        </span>
      ),
    })

    if (showAddForm) {
      rows.push({
        label: 'New tenant',
        value: (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              type="text"
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={miniInputStyle}
              aria-label="Tenant name"
            />
            <input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              style={miniInputStyle}
              aria-label="Tenant email"
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              style={miniInputStyle}
              aria-label="Tenant phone"
            />
            <span style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || !newName.trim() || !newEmail.trim()}
                style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 6, padding: '4px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                Create & link
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setErr('') }}
                style={{ border: '1px solid var(--border)', background: 'var(--elev)', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--dim)' }}
              >
                Cancel
              </button>
            </span>
          </span>
        ),
      })
    }
  }

  if (linked) {
    rows.push(
      {
        label: 'Name',
        value: linked.name,
        onClick: () => onNavigate({ kind: 'person', id: linked.id }),
      },
      {
        label: 'Email',
        value: linked.email || '—',
        onClick: () => onNavigate({ kind: 'person', id: linked.id }),
      },
      ...(linked.phone ? [{ label: 'Phone', value: linked.phone }] : []),
    )
  } else if (!canEdit) {
    const names = tenantNames(lease.tenantInfo)
    if (names) {
      names.split(', ').forEach((n) => {
        rows.push({
          label: '•',
          value: priv
            ? (lease.tenantInfo.split(',').find((s) => s.includes(n)) || n).trim()
            : n,
        })
      })
    } else if (lease.appsheetTenantIds) {
      rows.push({
        label: 'AppSheet IDs',
        value: <span style={{ color: 'var(--dim)', fontSize: 12 }}>{lease.appsheetTenantIds}</span>,
      })
    } else if (lease.tenantContactsRaw) {
      rows.push({
        label: 'Import data',
        value: <span style={{ color: 'var(--dim)', fontSize: 12, whiteSpace: 'pre-wrap' }}>{lease.tenantContactsRaw}</span>,
      })
    } else {
      rows.push({ label: '', value: 'No tenants on record' })
    }
  } else if (!linked && !showAddForm) {
    if (lease.tenantContactsRaw) {
      rows.push({
        label: 'Import data',
        value: <span style={{ color: 'var(--dim)', fontSize: 12, whiteSpace: 'pre-wrap' }}>{lease.tenantContactsRaw}</span>,
      })
    } else if (tenantNames(lease.tenantInfo)) {
      rows.push({
        label: 'Import data',
        value: <span style={{ color: 'var(--dim)', fontSize: 12 }}>{tenantNames(lease.tenantInfo)}</span>,
      })
    }
    if (lease.appsheetTenantIds) {
      rows.push({
        label: 'AppSheet IDs',
        value: <span style={{ color: 'var(--dim)', fontSize: 12 }}>{lease.appsheetTenantIds}</span>,
      })
    }
  }

  return <Section key="tenants" title="Tenants" rows={rows} />
}

function StatusSelect({
  value,
  options,
  onSave,
  disabled,
  formatOption,
}: {
  value: string
  options: string[]
  onSave: (v: string) => Promise<{ success: boolean; error?: string }>
  disabled?: boolean
  formatOption?: (v: string) => string
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const label = formatOption ?? ((v: string) => v)

  if (disabled) return <span style={{ fontWeight: 600 }}>{label(value) || '—'}</span>

  return (
    <span>
      <select
        className="cy-select cy-select--compact"
        value={value || options[0]}
        disabled={saving}
        onChange={async (e) => {
          setSaving(true)
          setErr('')
          const res = await onSave(e.target.value)
          if (!res.success) setErr(res.error ?? 'Failed')
          setSaving(false)
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{label(o)}</option>
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
    const display = type === 'date' ? (formatDisplayDate(value) || '—') : (value || '—')
    return <span style={{ fontWeight: 600, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{display}</span>
  }

  const enterEdit = () => {
    setDraft(value)
    setEditing(true)
    setErr('')
  }

  if (!editing) {
    const display = type === 'date' ? (formatDisplayDate(value) || '—') : (value || '—')
    return (
      <button
        type="button"
        className="cy-inline-field"
        onClick={enterEdit}
        aria-label={`Edit ${label}`}
      >
        {display}
      </button>
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
      {type === 'date' ? (
        <DatePickerField value={draft} onChange={setDraft} />
      ) : (
        <InputEl
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          {...({ value: draft, onChange: (e: any) => setDraft(e.target.value), type: type === 'textarea' ? undefined : type } as any)}
          rows={type === 'textarea' ? 3 : undefined}
          style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', fontWeight: 600, fontSize: 13, resize: type === 'textarea' ? 'vertical' : undefined }}
        />
      )}
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

const PROPERTY_TYPES = ['house', 'duplex', 'apartment_building', 'condo', 'townhouse', 'other'] as const
const PET_OPTIONS = ['No pets', 'Pet friendly', 'Cat friendly', 'Dog friendly', 'By approval'] as const

function formLabel(text: string): React.ReactNode {
  return <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--dim)', marginBottom: 4 }}>{text}</span>
}

const formFieldStyle: React.CSSProperties = {
  width: '100%', background: 'var(--input)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '7px 11px', fontWeight: 600, fontSize: 12.5, color: 'var(--text)',
}

function PropertyEditForm({
  property,
  priv,
  portfolios,
  owners,
  onClose,
  onSaved,
}: {
  property: CanaryProperty
  priv: boolean
  portfolios: { id: string; name: string }[]
  owners: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState(propertyStatusOption(property.status))
  const [propertyType, setPropertyType] = useState(property.type.replace(/ /g, '_') || 'house')
  const [city, setCity] = useState(property.city)
  const [province, setProvince] = useState(property.area)
  const [beds, setBeds] = useState(property.beds || '0')
  const [baths, setBaths] = useState(property.baths || '0')
  const [rent, setRent] = useState(property.rate != null ? String(property.rate) : '')
  const [pets, setPets] = useState(PET_OPTIONS.includes(property.petFriendly as typeof PET_OPTIONS[number]) ? property.petFriendly : 'No pets')
  const [portfolioId, setPortfolioId] = useState(property.portfolioId)
  const [ownerId, setOwnerId] = useState(property.ownerId)
  const [feeType, setFeeType] = useState(property.mgmtFeeType === 'flat' ? 'flat' : 'percent')
  const [feeValue, setFeeValue] = useState(property.mgmtFeeValue)
  const [hospitablePropertyId, setHospitablePropertyId] = useState(property.hospitablePropertyId || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setErr('')
    const bedsN = parseInt(beds, 10)
    const bathsN = parseFloat(baths)
    if (Number.isNaN(bedsN) || bedsN < 0) return setErr('Invalid bedroom count.')
    if (Number.isNaN(bathsN) || bathsN < 0) return setErr('Invalid bathroom count.')
    const rentN = rent.trim() === '' ? null : parseFloat(rent.replace(/[$,]/g, ''))
    if (rentN != null && (Number.isNaN(rentN) || rentN < 0)) return setErr('Invalid asking rent.')
    const feeN = feeValue.trim() === '' ? null : parseFloat(feeValue)
    if (feeN != null && (Number.isNaN(feeN) || feeN < 0)) return setErr('Invalid management fee.')
    const hospId = hospitablePropertyId.trim()
    if (hospId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hospId)) {
      return setErr('Hospitable property ID must be a UUID (or leave blank).')
    }
    if (!window.confirm('Save these property changes?')) return

    const payload: PropertyDetailsInput = {
      status: status as PropertyDetailsInput['status'],
      bedrooms: bedsN,
      bathrooms: bathsN,
      askingRent: rentN,
      pets: pets as PropertyDetailsInput['pets'],
      propertyType: propertyType as PropertyDetailsInput['propertyType'],
      city: city.trim(),
      province: province.trim(),
      portfolioId: portfolioId || null,
      ownerId: ownerId || null,
      managementFeeType: feeType as PropertyDetailsInput['managementFeeType'],
      managementFeeValue: feeN,
      hospitablePropertyId: hospId || null,
    }
    setSaving(true)
    const res = await updatePropertyDetails(property.unitId, payload)
    setSaving(false)
    if (res.success) {
      onSaved()
      onClose()
    } else {
      setErr(res.error ?? 'Failed to save.')
    }
  }

  return (
    <>
      <div onClick={onClose} className="cy-modal-backdrop cy-glass-modal-backdrop" style={{ zIndex: 70 }} />
      <div className="cy-glass-modal" style={{ width: 'min(520px,94vw)', maxHeight: '90vh', padding: 18, zIndex: 71 }} role="dialog" aria-modal="true" aria-label="Edit property">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div>
            <div className="cy-eyebrow" style={{ marginBottom: 4 }}>Edit property</div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{property.address}</div>
          </div>
          <button type="button" className="cy-btn" onClick={onClose} style={{ flex: 'none' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>{formLabel('Status')}
            <select className="cy-select cy-select--field" value={status} onChange={(e) => setStatus(e.target.value)}>
              {PROPERTY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>{formLabel('Type')}
            <select className="cy-select cy-select--field" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <label>{formLabel('City')}
            <input value={city} onChange={(e) => setCity(e.target.value)} style={formFieldStyle} />
          </label>
          <label>{formLabel('Province / area')}
            <input value={province} onChange={(e) => setProvince(e.target.value)} style={formFieldStyle} />
          </label>
          <label>{formLabel('Bedrooms')}
            <input type="number" min={0} value={beds} onChange={(e) => setBeds(e.target.value)} style={formFieldStyle} />
          </label>
          <label>{formLabel('Bathrooms')}
            <input type="number" min={0} step={0.5} value={baths} onChange={(e) => setBaths(e.target.value)} style={formFieldStyle} />
          </label>
          <label>{formLabel('Asking rent ($/mo)')}
            <input type="number" min={0} value={rent} onChange={(e) => setRent(e.target.value)} style={formFieldStyle} />
          </label>
          <label>{formLabel('Pets')}
            <select className="cy-select cy-select--field" value={pets} onChange={(e) => setPets(e.target.value)}>
              {PET_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        </div>

        {priv && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>🔒 Private — staff only</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>{formLabel('Portfolio')}
                <select className="cy-select cy-select--field" value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
                  <option value="">— None —</option>
                  {portfolios.map((pf) => <option key={pf.id} value={pf.id}>{pf.name}</option>)}
                </select>
              </label>
              <label>{formLabel('Owner')}
                <select className="cy-select cy-select--field" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                  <option value="">— None —</option>
                  {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              <label>{formLabel('Fee type')}
                <select className="cy-select cy-select--field" value={feeType} onChange={(e) => setFeeType(e.target.value)}>
                  <option value="percent">Percent (%)</option>
                  <option value="flat">Flat ($)</option>
                </select>
              </label>
              <label>{formLabel(feeType === 'percent' ? 'Management fee (%)' : 'Management fee ($)')}
                <input type="number" min={0} value={feeValue} onChange={(e) => setFeeValue(e.target.value)} style={formFieldStyle} />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>{formLabel('Hospitable property ID')}
                <input
                  type="text"
                  value={hospitablePropertyId}
                  onChange={(e) => setHospitablePropertyId(e.target.value)}
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  style={{ ...formFieldStyle, fontFamily: MONO, fontSize: 12 }}
                />
              </label>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--dim)', lineHeight: 1.45 }}>
              Paste the Hospitable property UUID to match STR bookings on the leases timeline. Leave blank for long-term-only units.
            </p>
          </div>
        )}

        {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 12 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button type="button" className="cy-btn" onClick={onClose}>Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="cy-btn-primary cy-accent-btn" style={{ opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </>
  )
}

type RowDef = { label: string; value: React.ReactNode; onClick?: () => void }

function Section({ title, rows }: { title: string; rows: RowDef[] }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="cy-drawer-section-title">{title}</div>
      {rows.map((dr, ri) => (
        <div key={ri} className={dr.onClick ? 'cy-drawer-row cy-hov' : 'cy-drawer-row'} onClick={dr.onClick} style={{ cursor: dr.onClick ? 'pointer' : 'default' }}>
          <span className="cy-drawer-row-label">{dr.label}</span>
          <span className="cy-drawer-row-value">{dr.value}</span>
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
  const [editingProperty, setEditingProperty] = useState(false)
  const [deletingLease, setDeletingLease] = useState(false)

  React.useEffect(() => {
    setEditingProperty(false)
  }, [drawer?.kind, drawer?.id])

  React.useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingProperty) setEditingProperty(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer, onClose, editingProperty])

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
  let propertyPhotoSection: React.ReactNode = null
  let found = true
  let propertyForEdit: CanaryProperty | null = null

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
                <StatusSelect value={leaseDbStatusFromDisplay(l.status)} options={LEASE_DB_STATUS} onSave={wrapSave((v) => updateLeaseField(l.id, 'status', v))} />
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
              label: 'Rental credit',
              value: <InlineField value={l.rentalCredit} label="rental credit" confirm onSave={wrapSave((v) => updateLeaseField(l.id, 'rental_credit', v))} disabled={!canEdit} />,
            },
            {
              label: 'Credit expires',
              value: <InlineField value={l.rentalCreditExpiry} label="rental credit expiry" type="date" confirm onSave={wrapSave((v) => updateLeaseField(l.id, 'rental_credit_expiry', v))} disabled={!canEdit} />,
            },
            {
              label: 'Term type',
              value: canEdit ? (
                <StatusSelect
                  value={l.termType}
                  options={LEASE_TERM_TYPE}
                  formatOption={(v) => LEASE_TERM_LABELS[v as keyof typeof LEASE_TERM_LABELS] ?? v}
                  onSave={wrapSave((v) => updateLeaseField(l.id, 'lease_term_type', v))}
                />
              ) : (LEASE_TERM_LABELS[l.termType] ?? l.termType),
            },
            {
              label: 'Start',
              value: <InlineField value={l.start} label="start date" type="date" confirm onSave={wrapSave((v) => updateLeaseField(l.id, 'start_date', v))} disabled={!canEdit} />,
            },
            {
              label: l.termType === 'month_to_month' ? 'End (optional)' : 'End',
              value: <InlineField value={l.end} label="end date" type="date" confirm onSave={wrapSave((v) => updateLeaseField(l.id, 'end_date', v))} disabled={!canEdit} />,
            },
            { label: 'Months', value: l.months || '—' },
          ]}
        />,
        <LeaseTenantSection
          key="tenants"
          lease={l}
          tenants={db.people.filter((p) => p.roles.includes('tenant'))}
          peopleById={peopleById}
          canEdit={canEdit}
          priv={priv}
          tenantNames={tenantNames}
          onNavigate={onNavigate}
          onSaved={refresh}
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
      kindLabel = p.archivedAt ? 'Property · Archived' : 'Property · ' + (p.status || '')
      propertyForEdit = p
      sections = [
        <Section
          key="overview"
          title="Overview"
          rows={[
            {
              label: 'Status',
              value: canEdit ? (
                <StatusSelect value={propertyStatusOption(p.status)} options={PROPERTY_STATUSES} onSave={wrapSave((v) => updatePropertyField(p.id, 'status', v))} />
              ) : (p.status || '—'),
            },
            {
              label: 'Type',
              value: canEdit ? (
                <StatusSelect
                  value={propertyTypeOption(p.type)}
                  options={PROPERTY_TYPE_OPTIONS}
                  formatOption={formatPropertyTypeLabel}
                  onSave={wrapSave((v) => updatePropertyField(p.id, 'property_type', v))}
                />
              ) : (p.type || '—'),
            },
            { label: 'Area', value: [p.city, p.area].filter(Boolean).join(' · ') || '—' },
            {
              label: 'Beds',
              value: canEdit ? (
                <InlineField value={p.beds} label="bedrooms" type="number" onSave={wrapSave((v) => updatePropertyField(p.id, 'bedrooms', v))} />
              ) : (p.beds || '—'),
            },
            {
              label: 'Baths',
              value: canEdit ? (
                <InlineField value={p.baths} label="bathrooms" type="number" onSave={wrapSave((v) => updatePropertyField(p.id, 'bathrooms', v))} />
              ) : (p.baths || '—'),
            },
            {
              label: 'Asking rate',
              value: canEdit ? (
                <InlineField value={p.rate != null ? String(p.rate) : ''} label="asking rate" type="number" confirm onSave={wrapSave((v) => updatePropertyField(p.id, 'asking_rent', v))} />
              ) : (p.rate ? money(p.rate) + '/mo' : '—'),
            },
            ...(propertyStatusOption(p.status) === 'STR'
              ? [{
                  label: 'Hospitable ID',
                  value: canEdit ? (
                    <InlineField
                      value={p.hospitablePropertyId || ''}
                      label="Hospitable property ID"
                      type="text"
                      confirm
                      onSave={wrapSave((v) => updatePropertyField(p.id, 'hospitable_property_id', v))}
                    />
                  ) : (p.hospitablePropertyId || '—'),
                }]
              : []),
            { label: 'Pets', value: p.petFriendly || '—' },
            ...(p.archivedAt ? [{ label: 'Archived', value: new Date(p.archivedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) }] : []),
          ]}
        />,
      ]
      if (canEdit && p.propertyDbId && db.orgId) {
        propertyPhotoSection = (
          <PropertyPhotoUpload
            propertyId={p.propertyDbId}
            orgId={db.orgId}
            gallery
            onChanged={refresh}
          />
        )
      }
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
      const pprops = db.properties.filter((p) => p.portfolioId === pf.id && !p.archivedAt)
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
            { label: 'Start', value: j.startDate || '—' },
            { label: 'End', value: j.endDate || '—' },
            { label: 'Completed', value: j.completedDate || '—' },
            { label: 'Estimate', value: <InlineField value={(j.estimate || '').replace(/[$,]/g, '')} label="estimate" type="number" confirm onSave={wrapSave((v) => updateProjectField(j.id, 'estimated_cost', v))} disabled={!canEdit} /> },
            { label: 'Budget', value: j.budget || '—' },
            { label: 'Contractor', value: j.contractors || '—' },
            { label: 'Risk (fire / water / rent / liability)', value: [j.fireRisk, j.waterDamageRisk, j.lossOfRentRisk, j.liabilityRisk].filter(Boolean).join(' / ') || '—' },
            { label: 'Description', value: <InlineField value={j.description} label="description" type="textarea" onSave={wrapSave((v) => updateProjectField(j.id, 'description', v))} disabled={!canEdit} /> },
            { label: 'Notes', value: j.notes || '—' },
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

  const handleDeleteLease = async (lease: CanaryLease) => {
    const msg = `Permanently delete lease at ${lease.property}?\n\nThis cannot be undone. Leases with payment records or checklists cannot be deleted.`
    if (!window.confirm(msg)) return
    setDeletingLease(true)
    try {
      const res = await deleteLease(lease.id)
      if (!res.success) {
        window.alert(res.error)
        return
      }
      onClose()
      router.refresh()
    } finally {
      setDeletingLease(false)
    }
  }

  const leaseForDelete = drawer.kind === 'lease' ? db.leases.find((x) => x.id === drawer.id) : undefined
  const isPropertyModal = drawer.kind === 'property'

  const primaryPropertyAction = actions.find((a) => a.label.includes('Draft lease')) ?? actions[actions.length - 1]
  const secondaryPropertyActions = primaryPropertyAction
    ? actions.filter((a) => a !== primaryPropertyAction)
    : actions

  if (isPropertyModal) {
    return (
      <>
        <div className="cy-property-modal-backdrop" onClick={onClose} aria-hidden="true" />
        <div
          className="cy-property-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="property-modal-title"
        >
          <header className="cy-property-modal-header">
            <button type="button" className="cy-property-modal-back-btn" onClick={onClose} aria-label="Close property details">
              ← Close
            </button>
            <div className="cy-property-modal-title-block">
              <div className="cy-eyebrow" style={{ marginBottom: 3 }}>{kindLabel}</div>
              <div id="property-modal-title" style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-.01em', lineHeight: 1.25 }}>{title}</div>
              {sub && <div style={{ color: 'var(--dim)', fontSize: 13, marginTop: 2 }}>{sub}</div>}
            </div>
            <div className="cy-property-modal-actions">
              {propertyForEdit && canEdit && (
                <button type="button" className="cy-property-modal-secondary-btn" onClick={() => setEditingProperty(true)}>✎ Edit</button>
              )}
              {secondaryPropertyActions.map((da) => (
                <button key={da.label} type="button" className="cy-property-modal-secondary-btn" onClick={da.onClick}>{da.label}</button>
              ))}
              {primaryPropertyAction && (
                <button key={primaryPropertyAction.label} type="button" className="cy-btn-primary cy-accent-btn" onClick={primaryPropertyAction.onClick}>{primaryPropertyAction.label}</button>
              )}
            </div>
          </header>
          <div className="cy-property-modal-body">
            <div className="cy-property-modal-fields">
              {sections}
              {auditTable && <AuditLogPanel key={auditKey} tableName={auditTable} recordId={auditId} canEdit={canEdit} />}
            </div>
            <div className="cy-property-modal-media">
              {propertyPhotoSection ?? (
                <div className="cy-property-modal-media-empty">
                  {canEdit ? 'Photos can be added once this property is linked to a database record.' : 'No photos available.'}
                </div>
              )}
            </div>
          </div>
        </div>
        {editingProperty && propertyForEdit && canEdit && (
          <PropertyEditForm
            property={propertyForEdit}
            priv={priv}
            portfolios={db.portfolios.map((pf) => ({ id: pf.id, name: pf.name }))}
            owners={db.people.filter((pe) => pe.role === 'Client').map((pe) => ({ id: pe.id, name: pe.name }))}
            onClose={() => setEditingProperty(false)}
            onSaved={refresh}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div onClick={onClose} className="cy-modal-backdrop cy-drawer-backdrop" aria-hidden="true" />
      <aside className="cy-drawer">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <div>
            <div className="cy-eyebrow" style={{ marginBottom: 3 }}>{kindLabel}</div>
            <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-.01em' }}>{title}</div>
            <div style={{ color: 'var(--dim)', fontSize: 13 }}>{sub}</div>
          </div>
          <button type="button" className="cy-btn" onClick={onClose} style={{ flex: 'none' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
          {propertyForEdit && canEdit && (
            <button type="button" className="cy-property-modal-secondary-btn" onClick={() => setEditingProperty(true)}>✎ Edit property</button>
          )}
          {actions.map((da) => (
            <button key={da.label} type="button" className="cy-btn-primary cy-accent-btn" onClick={da.onClick} style={{ margin: '4px 6px 4px 0', alignSelf: 'flex-start' }}>{da.label}</button>
          ))}
          {leaseForDelete && canEdit && (
            <button
              type="button"
              disabled={deletingLease}
              onClick={() => handleDeleteLease(leaseForDelete)}
              style={{ border: '1px solid var(--border)', background: 'none', color: 'var(--red)', borderRadius: 9, padding: '9px 14px', fontWeight: 600, cursor: deletingLease ? 'wait' : 'pointer', margin: '6px 8px 6px 0', alignSelf: 'flex-start', fontSize: 13 }}
            >
              {deletingLease ? 'Deleting…' : 'Delete lease'}
            </button>
          )}
        </div>
        <div style={{ flex: 1 }}>{sections}</div>
        {auditTable && <AuditLogPanel key={auditKey} tableName={auditTable} recordId={auditId} canEdit={canEdit} />}
      </aside>
      {editingProperty && propertyForEdit && canEdit && (
        <PropertyEditForm
          property={propertyForEdit}
          priv={priv}
          portfolios={db.portfolios.map((pf) => ({ id: pf.id, name: pf.name }))}
          owners={db.people.filter((pe) => pe.role === 'Client').map((pe) => ({ id: pe.id, name: pe.name }))}
          onClose={() => setEditingProperty(false)}
          onSaved={refresh}
        />
      )}
    </>
  )
}
