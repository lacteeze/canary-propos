'use client'

// CanaryApp — the authenticated Canary PM app shell.
// Faithful React port of the CanaryApp.dc design prototype, wired to live
// Supabase data (loaded server-side in src/app/(canary)/app/page.tsx).
import React, { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { deleteDraftListing, saveDraftListing, savePaymentEntry } from '@/app/actions/canary'
import type { CanaryDb, CanaryDraft, CanaryLease, CanaryPayment, CanaryPerson, CanaryPortfolio, CanaryProject, CanaryProperty, CanaryRole } from '@/lib/canary/types'
import './canary.css'

const MONO = "'IBM Plex Mono', monospace"
const DAY = 864e5

const TL_ZOOM_PRESETS = [
  { d: 1, label: '1d' }, { d: 3, label: '3d' }, { d: 7, label: '1wk' }, { d: 14, label: '2wk' },
  { d: 30, label: '1mo' }, { d: 60, label: '2mo' }, { d: 90, label: '3mo' }, { d: 182, label: '6mo' },
  { d: 270, label: '9mo' }, { d: 365, label: '1yr' }, { d: 547, label: '1.5yr' }, { d: 730, label: '2yr' },
]

const PAY_CATEGORIES = ['Rent Charge', 'Rent Payment', 'Damage Deposit', 'Management Fee', 'Maintenance', 'Leasing Fee', 'Supplies', 'Cleaning', 'Utilities', 'Other']

// ---------- helpers ----------
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}
function short(addr: string | null | undefined): string {
  return (addr || '').split(',')[0].trim()
}
function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return ''
  return '$' + Math.round(n).toLocaleString('en-CA')
}
function rentNum(r: string | null | undefined): number {
  const n = parseFloat(String(r || '').replace(/[$,]/g, ''))
  return Number.isNaN(n) ? 0 : n
}
function tenantNames(info: string | null | undefined): string {
  if (!info) return ''
  const names = info.split(',').map((s) => s.split(':')[0].trim()).filter((s) => s && !/@/.test(s) && !/^\d/.test(s))
  return [...new Set(names)].join(', ')
}
function fmtD(d: Date | null): string {
  return d ? d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}
function isoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

type ChatMsg = { role: 'user' | 'assistant'; text: string }
type Drawer = { kind: 'lease' | 'property' | 'person' | 'portfolio'; id: string } | null
type SortState = { key: string; dir: 'asc' | 'desc' } | null
type DraftForm = {
  id: string | null
  propId: string
  rent: string
  start: string
  end: string
  beds: string
  baths: string
  parking: string
  pets: string
  utilities: string
  description: string
  published: boolean
  address?: string
}
type PayFormState = { date: string; property: string; category: string; description: string; amount: string; type: 'Credit' | 'Debit' }

interface CanaryAppProps {
  db: CanaryDb
  userRole: CanaryRole
  userPersonId: string
  canSwitchRoles: boolean
  userName: string
}

// ---------- small render helpers ----------
function Icon({ paths }: { paths: string[] }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      {paths.map((p, i) => (<path key={i} d={p} />))}
    </svg>
  )
}

const ICONS: Record<string, string[]> = {
  home: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  dashboard: ['M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z'],
  leases: ['M3 4h18v18H3z', 'M3 9h18', 'M8 2v4', 'M16 2v4'],
  properties: ['M3 11l9-8 9 8', 'M5 10v10h14V10'],
  people: ['M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16.5 3.13a4 4 0 0 1 0 7.75'],
  portfolios: ['M3 7h18v13H3z', 'M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  payments: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  projects: ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
}

const monoLabel: React.CSSProperties = { fontFamily: MONO, fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }

export default function CanaryApp({ db, userRole, userPersonId, canSwitchRoles, userName }: CanaryAppProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [view, setView] = useState('home')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [role, setRole] = useState<CanaryRole>(userRole)
  const [personaId, setPersonaId] = useState(canSwitchRoles ? '' : userPersonId)
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [tlAnchor, setTlAnchor] = useState<number | null>(null)
  const [tlZoomIdx, setTlZoomIdx] = useState(7)
  const [tlStatusFilter, setTlStatusFilter] = useState<Record<string, boolean>>({})
  const [propFilter, setPropFilter] = useState('')
  const [peopleRole, setPeopleRole] = useState('')
  const [projFilter, setProjFilter] = useState('')
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [pageViews, setPageViews] = useState<Record<string, string>>({})
  const [pageSort, setPageSort] = useState<Record<string, SortState>>({})
  const [draftOpen, setDraftOpen] = useState(false)
  const [draft, setDraft] = useState<DraftForm | null>(null)
  const [draftError, setDraftError] = useState('')
  const [draftSaving, setDraftSaving] = useState(false)
  const [payFormOpen, setPayFormOpen] = useState(false)
  const [payForm, setPayForm] = useState<PayFormState | null>(null)
  const [payError, setPayError] = useState('')
  const [paySaving, setPaySaving] = useState(false)
  const [payCat, setPayCat] = useState('')
  const [payType, setPayType] = useState('')

  // restore persisted UI prefs
  React.useEffect(() => {
    try {
      const t = localStorage.getItem('canary_theme')
      if (t === 'light' || t === 'dark') setTheme(t)
      if (localStorage.getItem('canary_sidebar') === '1') setSidebarCollapsed(true)
    } catch { /* ignore */ }
  }, [])

  const priv = role === 'Admin' || role === 'Manager'
  const now = useMemo(() => new Date(), [])
  const todayMid = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()), [now])
  const soon = useMemo(() => new Date(now.getTime() + 90 * DAY), [now])
  const q = search.trim().toLowerCase()

  // ---------- persona-based data scoping (privileged role-preview) ----------
  const scoped = useMemo(() => {
    let { properties, leases, portfolios, projects, people } = db
    const drafts0 = db.drafts
    if (role === 'Owner' && personaId) {
      const pf = portfolios.filter((x) => (x.ownerIds || '').includes(personaId))
      const pfIds = new Set(pf.map((x) => x.id))
      properties = properties.filter((p) => pfIds.has(p.portfolioId) || p.ownerId === personaId)
      const addrs = new Set(properties.map((p) => p.address))
      leases = leases.filter((l) => addrs.has(l.property))
      projects = projects.filter((j) => addrs.has(j.property))
      portfolios = pf
      people = people.filter((x) => x.id === personaId)
    } else if (role === 'Tenant' && personaId) {
      leases = leases.filter((l) => (l.tenantIds || '').includes(personaId))
      const addrs = new Set(leases.map((l) => l.property))
      properties = properties.filter((p) => addrs.has(p.address))
      projects = projects.filter((j) => addrs.has(j.property))
      portfolios = []
      people = []
    } else if (role === 'Vendor' && personaId) {
      const me = db.people.find((x) => x.id === personaId)
      const nm = me ? me.name : '§none§'
      projects = projects.filter((j) => (j.contractors || '').includes(nm))
      const addrs = new Set(projects.map((j) => j.property))
      properties = properties.filter((p) => addrs.has(p.address))
      leases = []
      portfolios = []
      people = []
    }
    const drafts = priv ? drafts0 : role === 'Owner' ? drafts0.filter((d) => properties.some((p) => p.id === d.propId)) : []
    return { properties, leases, portfolios, projects, people, drafts }
  }, [db, role, personaId, priv])

  // ---------- personas ----------
  const personaOptions = useMemo(() => {
    if (priv) return []
    if (!canSwitchRoles) {
      const me = db.people.find((p) => p.id === userPersonId)
      return me ? [{ id: me.id, label: me.name }] : []
    }
    if (role === 'Owner') {
      const ownerIds = new Set<string>()
      db.portfolios.forEach((pf) => (pf.ownerIds || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((i) => ownerIds.add(i)))
      db.properties.forEach((p) => { if (p.ownerId) ownerIds.add(p.ownerId) })
      return db.people.filter((p) => ownerIds.has(p.id) && p.role === 'Client').map((p) => ({ id: p.id, label: p.name }))
    }
    if (role === 'Tenant') {
      const active = db.leases.filter((l) => l.status === 'Active' || l.status === 'Expiring' || l.status === 'Upcoming')
      const ids = new Map<string, string>()
      active.forEach((l) => (l.tenantIds || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((i) => ids.set(i, l.property)))
      return db.people.filter((p) => ids.has(p.id) && p.role === 'Tenant').slice(0, 200).map((p) => ({ id: p.id, label: p.name + ' — ' + short(ids.get(p.id)) }))
    }
    if (role === 'Vendor') {
      const names = new Set<string>()
      db.projects.forEach((j) => (j.contractors || '').split(',').forEach((s) => { const n = s.split(':')[0].trim(); if (n) names.add(n) }))
      const opts = db.people.filter((p) => p.role === 'Vendor' && names.has(p.name)).map((p) => ({ id: p.id, label: p.name }))
      return opts.length ? opts : db.people.filter((p) => p.role === 'Vendor').slice(0, 50).map((p) => ({ id: p.id, label: p.name }))
    }
    return []
  }, [db, role, priv, canSwitchRoles, userPersonId])

  const roleBanner = role === 'Owner'
    ? { label: 'Owner portal — viewing as', note: 'Owners see only their portfolios, properties, leases and projects.' }
    : role === 'Tenant'
      ? { label: 'Tenant portal — viewing as', note: 'Tenants see their own lease and home. Door codes and internal notes are hidden.' }
      : role === 'Vendor'
        ? { label: 'Vendor view — viewing as', note: 'Vendors see only projects assigned to them and the property address.' }
        : { label: '', note: '' }

  const onRoleChange = useCallback((next: CanaryRole) => {
    setRole(next)
    setView('home')
    setDrawer(null)
    setPersonaId('')
  }, [])

  React.useEffect(() => {
    if (!priv && canSwitchRoles && !personaId && personaOptions.length) setPersonaId(personaOptions[0].id)
  }, [priv, canSwitchRoles, personaId, personaOptions])

  // ---------- KPIs ----------
  const props = scoped.properties
  const activeLeases = scoped.leases.filter((l) => l.status === 'Active' || l.status === 'Expiring')
  const occupied = props.filter((p) => p.status === 'Leased' || p.status === 'Airbnb').length
  const hasSuccessor = useCallback((l: CanaryLease) => scoped.leases.some((o) => o !== l && o.property === l.property && (o.status === 'Upcoming' || (() => { const os = parseDate(o.start); const le = parseDate(l.end); return !!os && !!le && os > le })())), [scoped.leases])
  const expNoRenew = activeLeases.filter((l) => { const e = parseDate(l.end); return !!e && e >= now && e <= soon && !hasSuccessor(l) })
  const rentRoll = activeLeases.reduce((s, l) => s + rentNum(l.rent), 0)
  const kpis = [
    { label: 'Properties', value: String(props.length), color: 'var(--text)' },
    { label: 'Occupancy', value: props.length ? Math.round((occupied / props.length) * 100) + '%' : '—', color: 'var(--green)' },
    { label: 'Active leases', value: String(activeLeases.length), color: 'var(--text)' },
    { label: 'Expiring · no renewal', value: String(expNoRenew.length), color: 'var(--red)' },
    { label: 'Monthly rent roll', value: money(rentRoll), color: 'var(--text)' },
  ]

  // ---------- draft composer ----------
  const startDraftFor = useCallback((prop: CanaryProperty | null, presets?: { start?: string; end?: string }) => {
    const p = presets || {}
    setDrawer(null)
    setDraftError('')
    setDraft({
      id: null,
      propId: prop ? prop.id : '',
      rent: prop && prop.rate ? String(prop.rate) : '',
      start: p.start || '',
      end: p.end || '',
      beds: prop ? prop.beds || '' : '',
      baths: prop ? prop.baths || '' : '',
      parking: prop ? prop.parking || '' : '',
      pets: prop && /dog/i.test(prop.petFriendly || '') ? 'Dog friendly' : prop && /yes|pet/i.test(prop.petFriendly || '') ? 'Pet friendly' : 'No pets',
      utilities: prop && /yes|included/i.test(prop.utilitiesIncluded || '') ? 'Included' : 'Not included',
      description: prop?.description || '',
      published: false,
      address: prop?.address,
    })
    setDraftOpen(true)
  }, [])

  const openDraft = useCallback((d: CanaryDraft) => {
    setDraftError('')
    setDraft({ ...d })
    setDraftOpen(true)
  }, [])

  const submitDraft = useCallback(async () => {
    if (!draft || !draft.propId || draftSaving) return
    setDraftSaving(true)
    setDraftError('')
    const res = await saveDraftListing({
      id: draft.id,
      unitId: draft.propId,
      rent: draft.rent === '' ? null : rentNum(draft.rent),
      start: draft.start || null,
      description: draft.description || null,
      pets: draft.pets,
      utilities: draft.utilities,
      published: draft.published,
    })
    setDraftSaving(false)
    if (!res.success) { setDraftError(res.error); return }
    setDraftOpen(false)
    setDraft(null)
    setView('leases')
    startTransition(() => router.refresh())
  }, [draft, draftSaving, router])

  const removeDraft = useCallback(async () => {
    if (!draft?.id || draftSaving) return
    setDraftSaving(true)
    const res = await deleteDraftListing(draft.id)
    setDraftSaving(false)
    if (!res.success) { setDraftError(res.error); return }
    setDraftOpen(false)
    setDraft(null)
    startTransition(() => router.refresh())
  }, [draft, draftSaving, router])

  // ---------- payments ----------
  const emptyPayForm = useCallback((): PayFormState => ({ date: new Date().toISOString().slice(0, 10), property: '', category: 'Rent Payment', description: '', amount: '', type: 'Credit' }), [])
  const submitPayment = useCallback(async () => {
    const f = payForm
    if (!f || !f.amount || paySaving) return
    if (!f.property) { setPayError('Choose a property.'); return }
    setPaySaving(true)
    setPayError('')
    const res = await savePaymentEntry({ date: f.date, unitId: f.property, category: f.category, description: f.description, amount: f.amount, type: f.type })
    setPaySaving(false)
    if (!res.success) { setPayError(res.error); return }
    setPayFormOpen(false)
    setPayForm(null)
    startTransition(() => router.refresh())
  }, [payForm, paySaving, router])

  // ---------- chat ----------
  const sendChat = useCallback(async (text: string) => {
    const t = (text || '').trim()
    if (!t || chatBusy) return
    const msgs: ChatMsg[] = [...chat, { role: 'user', text: t }]
    setChat(msgs)
    setChatInput('')
    setChatBusy(true)
    try {
      const res = await fetch('/api/canary/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs, role }),
      })
      const data = await res.json()
      const reply = res.ok ? data.reply : data.error || 'Sorry — something went wrong.'
      setChat([...msgs, { role: 'assistant', text: reply }])
    } catch (err) {
      setChat([...msgs, { role: 'assistant', text: 'Sorry — something went wrong: ' + String(err) }])
    } finally {
      setChatBusy(false)
    }
  }, [chat, chatBusy, role])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }, [])

  // ---------- nav ----------
  const allNav: { key: string; label: string; privOnly?: boolean; hideFor?: CanaryRole[] }[] = [
    { key: 'home', label: 'Ask' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'leases', label: 'Leases' },
    { key: 'properties', label: 'Properties' },
    { key: 'people', label: 'People', privOnly: true },
    { key: 'portfolios', label: 'Portfolios', hideFor: ['Tenant', 'Vendor'] },
    { key: 'payments', label: 'Payments', hideFor: ['Vendor'] },
    { key: 'projects', label: 'Projects' },
  ]
  const navItems = allNav
    .filter((n) => !(n.privOnly && !priv))
    .filter((n) => !(n.hideFor && n.hideFor.includes(role)))

  // ---------- search matchers ----------
  const matchProp = (p: CanaryProperty) => !q || p.address.toLowerCase().includes(q)
  const matchLease = (l: CanaryLease) => !q || l.property.toLowerCase().includes(q) || (l.tenantInfo || '').toLowerCase().includes(q)

  // ---------- dashboard lists ----------
  const dashExpiring = [...expNoRenew]
    .sort((a, b) => (parseDate(a.end)?.getTime() ?? 0) - (parseDate(b.end)?.getTime() ?? 0))
    .slice(0, 6)
    .map((l) => {
      const e = parseDate(l.end)
      const days = e ? Math.round((e.getTime() - now.getTime()) / DAY) : 0
      return { id: l.id, short: short(l.property), tenants: tenantNames(l.tenantInfo) || '—', endLabel: fmtD(e), daysLeft: days + 'd left' }
    })
  const dashVacant = props.filter((p) => p.status === 'Vacant').slice(0, 6).map((p) => ({
    id: p.id,
    short: short(p.address),
    meta: [(p.beds || '?') + ' bd', (p.baths || '?') + ' ba', p.rate ? money(p.rate) + '/mo' : ''].filter(Boolean).join(' · '),
  }))
  const dashProjects = scoped.projects.filter((j) => j.status === 'In Progress' || j.status === 'Approved to Schedule').slice(0, 6)
  const prioRank = (j: CanaryProject) => { const n = parseInt(j.priority, 10); return Number.isNaN(n) ? 9 : n }
  const openProj = scoped.projects.filter((j) => j.status && !['Cancelled', 'Postponed', 'Completed', 'Closed'].includes(j.status))
  const topProject = [...openProj].sort((a, b) => prioRank(a) - prioRank(b) || (a.status === 'In Progress' ? -1 : 0))[0] || null
  const dashDrafts = scoped.drafts.slice(0, 5)

  // ---------- timeline ----------
  const zoomIdx = Math.max(0, Math.min(TL_ZOOM_PRESETS.length - 1, tlZoomIdx))
  const spanDays = TL_ZOOM_PRESETS[zoomIdx].d
  const anchor = tlAnchor != null ? new Date(tlAnchor) : new Date(todayMid.getTime() - Math.round(spanDays / 4) * DAY)
  const winStart = anchor
  const winEnd = new Date(winStart.getTime() + spanDays * DAY)
  const span = winEnd.getTime() - winStart.getTime()
  const pct = (d: Date | number) => Math.max(0, Math.min(100, ((typeof d === 'number' ? d : d.getTime()) - winStart.getTime()) / span * 100))
  const tlTicks: { left: string; label: string; weight: number }[] = []
  const pushTick = (t: Date, label: string, isYearStart: boolean) => tlTicks.push({ left: pct(t).toFixed(2) + '%', label, weight: isYearStart ? 700 : 500 })
  if (spanDays <= 7) {
    for (let t = new Date(winStart); t <= winEnd; t.setDate(t.getDate() + 1)) pushTick(new Date(t), t.toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric' }), false)
  } else if (spanDays <= 45) {
    for (let t = new Date(winStart); t <= winEnd; t.setDate(t.getDate() + 7)) pushTick(new Date(t), t.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }), false)
  } else if (spanDays <= 450) {
    for (let t = new Date(winStart.getFullYear(), winStart.getMonth(), 1); t <= winEnd; t = new Date(t.getFullYear(), t.getMonth() + 1, 1)) pushTick(t, t.toLocaleDateString('en-CA', { month: 'short' }), t.getMonth() === 0)
  } else {
    for (let t = new Date(winStart.getFullYear(), Math.floor(winStart.getMonth() / 3) * 3, 1); t <= winEnd; t = new Date(t.getFullYear(), t.getMonth() + 3, 1)) pushTick(t, t.toLocaleDateString('en-CA', { month: 'short' }), t.getMonth() === 0)
  }
  const tlTodayLeft = pct(now).toFixed(2) + '%'
  const tlSliderOffset = Math.round((winStart.getTime() - todayMid.getTime()) / DAY)
  const fdef: Record<string, boolean> = { active: true, expiring: true, upcoming: true, draft: true, past: false }
  const filt = { ...fdef, ...tlStatusFilter }
  const filterMeta = [
    { key: 'active', label: 'Active', dot: 'var(--green)' },
    { key: 'expiring', label: 'Expiring', dot: 'var(--red)' },
    { key: 'upcoming', label: 'Upcoming', dot: 'var(--amber)' },
    { key: 'draft', label: 'Drafts', dot: 'var(--accent)' },
    { key: 'past', label: 'Past', dot: 'var(--gray)' },
  ]

  const leasesByProp = useMemo(() => {
    const m = new Map<string, CanaryLease[]>()
    scoped.leases.forEach((l) => { const k = l.property; if (!m.has(k)) m.set(k, []); m.get(k)!.push(l) })
    return m
  }, [scoped.leases])
  const draftsByProp = useMemo(() => {
    const m = new Map<string, CanaryDraft[]>()
    scoped.drafts.forEach((d) => { const k = d.address; if (!m.has(k)) m.set(k, []); m.get(k)!.push(d) })
    return m
  }, [scoped.drafts])

  const catOf = (l: CanaryLease) => {
    if (l.status === 'Upcoming') return 'upcoming'
    if (l.status === 'Active' || l.status === 'Expiring') {
      const e = parseDate(l.end)
      return (e && e <= soon && !hasSuccessor(l)) || l.status === 'Expiring' ? 'expiring' : 'active'
    }
    return 'past'
  }

  type TlBar = { left: string; width: string; bg: string; color: string; borderStyle: string; label: string; title: string; onClick: () => void }
  const tlRows = props.filter(matchProp).map((p) => {
    const ls = leasesByProp.get(p.address) || []
    const current = ls.filter((l) => l.status === 'Active' || l.status === 'Expiring')[0]
    const nextEnd = current ? parseDate(current.end) : null
    const bars: TlBar[] = []
    ls.forEach((l) => {
      const s = parseDate(l.start), e = parseDate(l.end)
      if (!s || !e || e < winStart || s > winEnd) return
      const cat = catOf(l)
      if (!filt[cat]) return
      const [bg, color] = cat === 'expiring' ? ['var(--red)', 'var(--red-text)'] : cat === 'upcoming' ? ['var(--amber)', 'var(--amber-text)'] : cat === 'active' ? ['var(--green)', 'var(--green-text)'] : ['var(--gray)', 'var(--bg)']
      bars.push({
        left: pct(s).toFixed(2) + '%', width: Math.max(1.6, pct(e) - pct(s)).toFixed(2) + '%',
        bg, color, borderStyle: 'none', label: tenantNames(l.tenantInfo) || l.status,
        title: l.status + ' · ' + (l.rent || '') + ' · ' + l.start + ' → ' + l.end,
        onClick: () => setDrawer({ kind: 'lease', id: l.id }),
      })
    })
    if (filt.draft) (draftsByProp.get(p.address) || []).forEach((d) => {
      const s = parseDate(d.start)
      const e = parseDate(d.end) || (s ? new Date(s.getTime() + 365 * DAY) : null)
      if (!s || !e || e < winStart || s > winEnd) return
      bars.push({
        left: pct(s).toFixed(2) + '%', width: Math.max(1.6, pct(e) - pct(s)).toFixed(2) + '%',
        bg: 'transparent', color: 'var(--accent)', borderStyle: '2px dashed var(--accent)',
        label: d.published ? 'Listing · public' : 'Draft lease',
        title: 'Draft · $' + d.rent + '/mo', onClick: () => openDraft(d),
      })
    })
    return {
      id: p.id,
      short: short(p.address),
      sub: current ? [tenantNames(current.tenantInfo), current.rent ? money(rentNum(current.rent)) + '/mo' : ''].filter(Boolean).join(' · ') : p.status || '',
      sortKey: nextEnd ? nextEnd.getTime() : 9e15,
      bars,
    }
  }).sort((a, b) => a.sortKey - b.sortKey)

  // ---------- filters / lists per page ----------
  const statuses = ['', 'Vacant', 'Leased', 'Airbnb', 'Project', 'Office']
  const chipFor = (st: string): [string, string] => st === 'Leased' ? ['var(--green)', 'var(--green-text)'] : st === 'Vacant' ? ['var(--amber)', 'var(--amber-text)'] : st === 'Airbnb' ? ['var(--blue)', 'var(--bg)'] : ['var(--elev)', 'var(--dim)']
  const filteredProps = props.filter(matchProp).filter((p) => !propFilter || p.status === propFilter)

  const roles = ['', 'Client', 'Tenant', 'Vendor', 'Admin', 'Cleaner', 'Contact', 'Realtor', 'Accountant']
  const roleCounts: Record<string, number> = {}
  scoped.people.forEach((p) => { roleCounts[p.role] = (roleCounts[p.role] || 0) + 1 })
  const filteredPeople = scoped.people.filter((p) => (!peopleRole || p.role === peopleRole) && (!q || (p.name + ' ' + p.email + ' ' + p.company).toLowerCase().includes(q)))

  const peopleById = useMemo(() => { const m = new Map<string, CanaryPerson>(); db.people.forEach((p) => m.set(p.id, p)); return m }, [db.people])
  const filteredPf = scoped.portfolios.filter((pf) => !q || pf.name.toLowerCase().includes(q))
  const pfOwnersOf = (pf: CanaryPortfolio) => (pf.ownerIds || '').split(',').map((s) => s.trim()).filter(Boolean).map((i) => peopleById.get(i)?.name).filter(Boolean).join(', ')

  const filteredPay = db.payments.filter((p) => (!payCat || p.category === payCat) && (!payType || p.type === payType) && (!q || (p.property + ' ' + p.description).toLowerCase().includes(q)))
  const payNetN = filteredPay.reduce((s, p) => s + (p.type === 'Debit' ? -1 : 1) * (parseFloat(p.amount) || 0), 0)

  const projStatuses = useMemo(() => {
    const uniq = [...new Set(scoped.projects.map((j) => j.status).filter(Boolean))]
    return ['', ...uniq]
  }, [scoped.projects])
  const pjCounts: Record<string, number> = {}
  scoped.projects.forEach((j) => { pjCounts[j.status] = (pjCounts[j.status] || 0) + 1 })
  const filteredProj = scoped.projects.filter((j) => (!projFilter || j.status === projFilter) && (!q || (j.name + ' ' + j.property).toLowerCase().includes(q)))

  // ---------- multi-view (table / kanban / gantt) ----------
  const page = view
  const curSort = pageSort[page] ?? null
  const setSort = (key: string, dir: 'asc' | 'desc') => setPageSort((s) => ({ ...s, [page]: key ? { key, dir } : null }))

  function qsort<T>(arr: T[], getters: Record<string, (x: T) => string | number>): T[] {
    const s = curSort
    if (!s || !s.key) return arr
    const g = getters[s.key]
    if (!g) return arr
    return [...arr].sort((a, b) => { const av = g(a), bv = g(b); const r = av < bv ? -1 : av > bv ? 1 : 0; return s.dir === 'desc' ? -r : r })
  }

  const leaseStatusColor = (l: CanaryLease) => l.status === 'Active' ? 'var(--green)' : l.status === 'Expiring' ? 'var(--red)' : l.status === 'Upcoming' ? 'var(--amber)' : 'var(--dim)'
  const projStatusColor = (j: CanaryProject) => j.status === 'In Progress' ? 'var(--green)' : j.status === 'Postponed' || j.status === 'Cancelled' ? 'var(--faint)' : 'var(--amber)'

  /* eslint-disable @typescript-eslint/no-explicit-any */
  type ColDef = { key: string; label: string; flex: string; align?: string; bold?: boolean; dim?: boolean; mono?: boolean; color?: (r: any) => string; get: (r: any) => string }
  type PageDef = { views: string[]; rows: any[]; open: ((r: any) => (() => void)) | null; group?: (r: any) => string; groupOrder?: string[]; card?: (r: any) => { title: string; sub: string; right: string; rightColor: string }; cols: ColDef[]; getters: Record<string, (x: any) => string | number> }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const pageDefs: Record<string, PageDef> = {
    leases: {
      views: ['timeline', 'table'],
      rows: qsort(scoped.leases.filter(matchLease), {
        property: (l: CanaryLease) => short(l.property).toLowerCase(), status: (l: CanaryLease) => l.status || '', tenants: (l: CanaryLease) => tenantNames(l.tenantInfo).toLowerCase(), start: (l: CanaryLease) => l.start || '', end: (l: CanaryLease) => l.end || '', rent: (l: CanaryLease) => rentNum(l.rent),
      }),
      open: (l: CanaryLease) => () => setDrawer({ kind: 'lease', id: l.id }),
      cols: [
        { key: 'property', label: 'Property', flex: '1.8', bold: true, get: (l: CanaryLease) => short(l.property) },
        { key: 'status', label: 'Status', flex: '1', color: leaseStatusColor, get: (l: CanaryLease) => l.status || '—' },
        { key: 'tenants', label: 'Tenants', flex: '2', dim: true, get: (l: CanaryLease) => tenantNames(l.tenantInfo) || '—' },
        { key: 'start', label: 'Start', flex: '0 0 96px', mono: true, get: (l: CanaryLease) => l.start || '—' },
        { key: 'end', label: 'End', flex: '0 0 96px', mono: true, get: (l: CanaryLease) => l.end || '—' },
        { key: 'rent', label: 'Rent', flex: '0 0 84px', align: 'right', bold: true, get: (l: CanaryLease) => (rentNum(l.rent) ? money(rentNum(l.rent)) : '—') },
      ],
      getters: {},
    },
    properties: {
      views: ['cards', 'table', 'kanban'],
      rows: qsort(filteredProps, {
        address: (p: CanaryProperty) => short(p.address).toLowerCase(), city: (p: CanaryProperty) => ((p.city || '') + ' ' + (p.area || '')).toLowerCase(), status: (p: CanaryProperty) => p.status || '', beds: (p: CanaryProperty) => parseFloat(p.beds) || 0, baths: (p: CanaryProperty) => parseFloat(p.baths) || 0, parking: (p: CanaryProperty) => parseFloat(p.parking) || 0, rate: (p: CanaryProperty) => p.rate || 0,
      }),
      open: (p: CanaryProperty) => () => setDrawer({ kind: 'property', id: p.id }),
      group: (p: CanaryProperty) => p.status || '—',
      groupOrder: ['Vacant', 'Leased', 'Airbnb', 'Project', 'Office'],
      card: (p: CanaryProperty) => ({ title: short(p.address), sub: [[p.beds, 'bd'].join(' '), [p.baths, 'ba'].join(' '), [p.city, p.area].filter(Boolean).join(' ')].join(' · '), right: p.rate ? money(p.rate) : '', rightColor: 'var(--text)' }),
      cols: [
        { key: 'address', label: 'Address', flex: '2', bold: true, get: (p: CanaryProperty) => short(p.address) },
        { key: 'city', label: 'City · Area', flex: '1.5', dim: true, get: (p: CanaryProperty) => [p.city, p.area].filter(Boolean).join(' · ') || '—' },
        { key: 'status', label: 'Status', flex: '1', get: (p: CanaryProperty) => p.status || '—' },
        { key: 'beds', label: 'Beds', flex: '0 0 56px', align: 'right', get: (p: CanaryProperty) => p.beds || '—' },
        { key: 'baths', label: 'Baths', flex: '0 0 56px', align: 'right', get: (p: CanaryProperty) => p.baths || '—' },
        { key: 'rate', label: 'Rate', flex: '0 0 90px', align: 'right', bold: true, get: (p: CanaryProperty) => (p.rate ? money(p.rate) + '/mo' : '—') },
      ],
      getters: {},
    },
    people: {
      views: ['list', 'table', 'kanban'],
      rows: qsort(filteredPeople, {
        name: (p: CanaryPerson) => (p.name || '').toLowerCase(), email: (p: CanaryPerson) => (p.email || '').toLowerCase(), phone: (p: CanaryPerson) => p.phone || '', role: (p: CanaryPerson) => p.role || '', status: (p: CanaryPerson) => p.status || '',
      }),
      open: (p: CanaryPerson) => () => setDrawer({ kind: 'person', id: p.id }),
      group: (p: CanaryPerson) => p.role || '—',
      card: (p: CanaryPerson) => ({ title: p.name || '—', sub: p.email || p.phone || '', right: '', rightColor: 'var(--text)' }),
      cols: [
        { key: 'name', label: 'Name', flex: '1.6', bold: true, get: (p: CanaryPerson) => p.name || '—' },
        { key: 'email', label: 'Email', flex: '2', dim: true, get: (p: CanaryPerson) => p.email || '—' },
        { key: 'phone', label: 'Phone', flex: '1.2', mono: true, get: (p: CanaryPerson) => p.phone || '—' },
        { key: 'role', label: 'Role', flex: '0 0 92px', get: (p: CanaryPerson) => p.role || '—' },
        { key: 'status', label: 'Status', flex: '1', dim: true, get: (p: CanaryPerson) => p.status || '—' },
      ],
      getters: {},
    },
    portfolios: {
      views: ['cards', 'table', 'kanban'],
      rows: qsort(filteredPf, {
        name: (pf: CanaryPortfolio) => (pf.name || '').toLowerCase(), owners: (pf: CanaryPortfolio) => pfOwnersOf(pf).toLowerCase(), status: (pf: CanaryPortfolio) => pf.status || '', propCount: (pf: CanaryPortfolio) => props.filter((p) => p.portfolioId === pf.id).length,
      }),
      open: (pf: CanaryPortfolio) => () => setDrawer({ kind: 'portfolio', id: pf.id }),
      group: (pf: CanaryPortfolio) => pf.status || '—',
      groupOrder: ['Active', 'Inactive'],
      card: (pf: CanaryPortfolio) => ({ title: pf.name, sub: pfOwnersOf(pf) || '—', right: props.filter((p) => p.portfolioId === pf.id).length + ' prop', rightColor: 'var(--dim)' }),
      cols: [
        { key: 'name', label: 'Portfolio', flex: '1.6', bold: true, get: (pf: CanaryPortfolio) => pf.name },
        { key: 'owners', label: 'Owners', flex: '2', dim: true, get: (pf: CanaryPortfolio) => pfOwnersOf(pf) || '—' },
        { key: 'status', label: 'Status', flex: '0 0 84px', get: (pf: CanaryPortfolio) => pf.status || '—' },
        { key: 'propCount', label: 'Props', flex: '0 0 60px', align: 'right', get: (pf: CanaryPortfolio) => String(props.filter((p) => p.portfolioId === pf.id).length) },
      ],
      getters: {},
    },
    payments: {
      views: ['table', 'kanban'],
      rows: qsort(filteredPay, {
        date: (p: CanaryPayment) => p.date || '', property: (p: CanaryPayment) => short(p.property || '').toLowerCase(), category: (p: CanaryPayment) => p.category || '', description: (p: CanaryPayment) => (p.description || '').toLowerCase(), amount: (p: CanaryPayment) => (p.type === 'Debit' ? -1 : 1) * (parseFloat(p.amount) || 0), type: (p: CanaryPayment) => p.type || '',
      }),
      open: null,
      group: (p: CanaryPayment) => p.category || '—',
      card: (p: CanaryPayment) => ({ title: short(p.property || '') || '—', sub: (p.date || '') + (p.description ? ' · ' + p.description : ''), right: (p.type === 'Debit' ? '−' : '') + money(Math.abs(parseFloat(p.amount) || 0)), rightColor: p.type === 'Debit' ? 'var(--red)' : 'var(--green)' }),
      cols: [
        { key: 'date', label: 'Date', flex: '0 0 92px', mono: true, get: (p: CanaryPayment) => p.date || '—' },
        { key: 'property', label: 'Property', flex: '2', bold: true, get: (p: CanaryPayment) => short(p.property || '') || '—' },
        { key: 'category', label: 'Category', flex: '1.2', dim: true, get: (p: CanaryPayment) => p.category || '—' },
        { key: 'description', label: 'Description', flex: '2', dim: true, get: (p: CanaryPayment) => p.description || '—' },
        { key: 'amount', label: 'Total', flex: '0 0 90px', align: 'right', bold: true, color: (p: CanaryPayment) => (p.type === 'Debit' ? 'var(--red)' : 'var(--green)'), get: (p: CanaryPayment) => (p.type === 'Debit' ? '−' : '') + money(Math.abs(parseFloat(p.amount) || 0)) },
        { key: 'type', label: 'Type', flex: '0 0 60px', align: 'right', dim: true, get: (p: CanaryPayment) => p.type || '—' },
      ],
      getters: {},
    },
    projects: {
      views: ['cards', 'table', 'kanban', 'gantt'],
      rows: qsort(filteredProj, {
        name: (j: CanaryProject) => (j.name || '').toLowerCase(), property: (j: CanaryProject) => short(j.property).toLowerCase(), status: (j: CanaryProject) => j.status || '', priority: (j: CanaryProject) => prioRank(j), estimate: (j: CanaryProject) => parseFloat(String(j.estimate || '').replace(/[$,]/g, '')) || 0,
      }),
      open: null,
      group: (j: CanaryProject) => j.status || '—',
      groupOrder: ['In Progress', 'Approved to Schedule', 'Reviewing Estimates', 'Requires Estimate', 'Estimate', 'Postponed', 'Cancelled'],
      card: (j: CanaryProject) => ({ title: j.name || 'Untitled', sub: short(j.property) + ' · ' + (j.priority || 'No priority'), right: j.estimate || '', rightColor: 'var(--dim)' }),
      cols: [
        { key: 'name', label: 'Project', flex: '2', bold: true, get: (j: CanaryProject) => j.name || 'Untitled' },
        { key: 'property', label: 'Property', flex: '1.4', dim: true, get: (j: CanaryProject) => short(j.property) },
        { key: 'status', label: 'Status', flex: '1.3', color: projStatusColor, get: (j: CanaryProject) => j.status || '—' },
        { key: 'priority', label: 'Priority', flex: '0 0 104px', get: (j: CanaryProject) => j.priority || '—' },
        { key: 'estimate', label: 'Estimate', flex: '0 0 84px', align: 'right', dim: true, get: (j: CanaryProject) => j.estimate || '—' },
      ],
      getters: {},
    },
  }

  const pdef = pageDefs[page]
  const viewLabels: Record<string, string> = { timeline: 'Timeline', table: 'Table', cards: 'Cards', list: 'List', kanban: 'Kanban', gantt: 'Gantt' }
  const curView = pdef ? pageViews[page] || pdef.views[0] : ''
  const genRows = pdef ? pdef.rows : []
  const tblCap = 200
  const showDefault = pdef ? curView === pdef.views[0] && pdef.views[0] !== 'table' : true
  const showTable = pdef ? curView === 'table' : false
  const showKanban = pdef ? curView === 'kanban' : false
  const showGantt = page === 'projects' && curView === 'gantt'

  // kanban columns
  type KanCol = { title: string; count: string; more: boolean; moreLabel: string; cards: { title: string; sub: string; right: string; rightColor: string; onClick: (() => void) | null }[] }
  let kanCols: KanCol[] = []
  if (pdef && pdef.group && showKanban) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const groups = new Map<string, any[]>()
    genRows.forEach((r) => { const g = pdef.group!(r); if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(r) })
    const order = (pdef.groupOrder || []).filter((g) => groups.has(g)).concat([...groups.keys()].filter((g) => !(pdef.groupOrder || []).includes(g)).sort())
    kanCols = order.map((g) => {
      const list = groups.get(g)!
      return {
        title: g, count: String(list.length),
        more: list.length > 30, moreLabel: '+ ' + (list.length - 30) + ' more — refine with search',
        cards: list.slice(0, 30).map((r) => ({ ...pdef.card!(r), onClick: pdef.open ? pdef.open(r) : null })),
      }
    })
  }

  // gantt (projects)
  let gTicks: { left: string; label: string }[] = []
  let gRows: { name: string; sub: string; left: string; width: string; bg: string; color: string; barLabel: string; title: string }[] = []
  let gTodayLeft = '0%'
  if (showGantt) {
    const hashN = (s: string) => { let h = 0; const t = s || ''; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h }
    const gStart = new Date(todayMid.getTime() - 21 * DAY)
    const gEnd = new Date(todayMid.getTime() + 119 * DAY)
    const gSpan = gEnd.getTime() - gStart.getTime()
    const gPct = (d: Date) => Math.max(0, Math.min(100, (d.getTime() - gStart.getTime()) / gSpan * 100))
    for (let t = new Date(gStart.getFullYear(), gStart.getMonth(), 1); t <= gEnd; t = new Date(t.getFullYear(), t.getMonth() + 1, 1)) {
      if (t >= gStart) gTicks.push({ left: gPct(t).toFixed(2) + '%', label: t.toLocaleDateString('en-CA', { month: 'short' }) })
    }
    gTodayLeft = gPct(todayMid).toFixed(2) + '%'
    const prioBar = (j: CanaryProject): [string, string] => { const n = prioRank(j); return n === 1 ? ['var(--red)', 'var(--red-text)'] : n === 2 ? ['var(--amber)', 'var(--amber-text)'] : n === 3 ? ['var(--green)', 'var(--green-text)'] : ['var(--gray)', 'var(--bg)'] }
    gRows = (genRows as CanaryProject[]).map((j) => {
      const p = prioRank(j), h = hashN(j.id)
      let startOff: number, dur: number
      if (j.status === 'In Progress') { startOff = -(3 + (h % 10)); dur = 14 + p * 7 }
      else if (j.status === 'Approved to Schedule') { startOff = 2 + p * 4 + (h % 7); dur = 7 + p * 5 }
      else if (/estimate/i.test(j.status || '')) { startOff = 7 + p * 6 + (h % 10); dur = 7 + p * 6 }
      else { startOff = 40 + p * 8 + (h % 14); dur = 14 }
      const s = new Date(todayMid.getTime() + startOff * DAY)
      const e = new Date(s.getTime() + dur * DAY)
      const [bg, color] = prioBar(j)
      return {
        name: j.name || 'Untitled', sub: short(j.property) + ' · ' + (j.priority || 'No priority'),
        left: gPct(s).toFixed(2) + '%', width: Math.max(2, gPct(e) - gPct(s)).toFixed(2) + '%',
        bg, color, barLabel: j.status || '', title: (j.name || '') + ' · ' + (j.status || '') + ' · ' + (j.priority || ''),
      }
    })
  }

  // ---------- drawer ----------
  type DrawerRow = { k: string; v: string; vColor: string; onClick: (() => void) | null }
  type DrawerSection = { title: string; rows: DrawerRow[] }
  const drawerRow = (k: string, v: string | null | undefined, opts?: { color?: string; onClick?: () => void }): DrawerRow => ({ k, v: v == null || v === '' ? '—' : String(v), vColor: opts?.color || 'var(--text)', onClick: opts?.onClick || null })

  let drawerVals: { open: boolean; kind: string; title: string; sub: string; sections: DrawerSection[]; actions: { label: string; onClick: () => void }[] } = { open: false, kind: '', title: '', sub: '', sections: [], actions: [] }
  if (drawer) {
    const sections: DrawerSection[] = []
    const actions: { label: string; onClick: () => void }[] = []
    let title = '', sub = '', kindLabel: string = drawer.kind
    let found = true

    if (drawer.kind === 'lease') {
      const l = db.leases.find((x) => x.id === drawer.id)
      if (!l) found = false
      else {
        title = short(l.property); sub = l.property; kindLabel = 'Lease · ' + (l.status || '')
        sections.push({
          title: 'Lease details',
          rows: [
            drawerRow('Status', l.status, { color: l.status === 'Active' ? 'var(--green)' : l.status === 'Expiring' ? 'var(--red)' : 'var(--text)' }),
            drawerRow('Rent', l.rent), drawerRow('Deposit', l.deposit),
            drawerRow('Start', l.start), drawerRow('End', l.end), drawerRow('Months', l.months),
            l.renewal ? drawerRow('Renewal', l.renewal) : null,
          ].filter(Boolean) as DrawerRow[],
        })
        const tenants = tenantNames(l.tenantInfo)
        sections.push({ title: 'Tenants', rows: tenants ? tenants.split(', ').map((n) => drawerRow('•', priv ? (l.tenantInfo.split(',').find((s) => s.includes(n)) || n).trim() : n)) : [drawerRow('', 'No tenants on record')] })
        const related = db.projects.filter((j) => j.property === l.property)
        if (related.length) sections.push({ title: 'Tasks & projects at property', rows: related.map((j) => drawerRow(j.status || '—', j.name)) })
        if (priv) actions.push({
          label: 'Draft renewal listing',
          onClick: () => {
            const p = db.properties.find((x) => x.address === l.property)
            const e = parseDate(l.end)
            const s = e ? new Date(e.getTime() + DAY) : null
            const e2 = s ? new Date(s.getFullYear() + 1, s.getMonth(), s.getDate() - 1) : null
            startDraftFor(p || null, { start: isoDate(s), end: isoDate(e2) })
          },
        })
      }
    }

    if (drawer.kind === 'property') {
      const p = db.properties.find((x) => x.id === drawer.id)
      if (!p) found = false
      else {
        title = short(p.address); sub = p.address; kindLabel = 'Property · ' + (p.status || '')
        sections.push({
          title: 'Overview',
          rows: [
            drawerRow('Status', p.status), drawerRow('Type', p.type), drawerRow('Area', [p.city, p.area].filter(Boolean).join(' · ')),
            drawerRow('Beds / Baths', [p.beds, p.baths].map((x) => x || '—').join(' / ')),
            drawerRow('Asking rate', p.rate ? money(p.rate) + '/mo' : ''),
            drawerRow('Pets', p.petFriendly),
          ],
        })
        if (priv) {
          sections.push({
            title: '🔒 Private — staff only',
            rows: [
              drawerRow('Portfolio', p.portfolioId ? db.portfolios.find((pf) => pf.id === p.portfolioId)?.name ?? '' : ''),
              drawerRow('Owner', peopleById.get(p.ownerId)?.name ?? ''),
              drawerRow('Management fee', p.mgmtFee),
            ],
          })
        }
        const hist = db.leases.filter((l) => l.property === p.address).sort((a, b) => (parseDate(b.start)?.getTime() ?? 0) - (parseDate(a.start)?.getTime() ?? 0))
        sections.push({ title: 'Lease history (' + hist.length + ')', rows: hist.slice(0, 10).map((l) => drawerRow(l.status || '—', (l.start || '?') + ' → ' + (l.end || '?') + ' · ' + (l.rent || '') + (tenantNames(l.tenantInfo) ? ' · ' + tenantNames(l.tenantInfo) : ''), { onClick: () => setDrawer({ kind: 'lease', id: l.id }) })) })
        const related = db.projects.filter((j) => j.property === p.address)
        if (related.length) sections.push({ title: 'Open projects', rows: related.map((j) => drawerRow(j.status || '—', j.name)) })
        if (priv) actions.push({ label: '+ Draft lease from this property', onClick: () => startDraftFor(p) })
      }
    }

    if (drawer.kind === 'person') {
      const p = db.people.find((x) => x.id === drawer.id)
      if (!p) found = false
      else {
        title = p.name; sub = p.company && p.company !== p.name ? p.company : ''; kindLabel = p.role || 'Person'
        sections.push({ title: 'Contact', rows: [drawerRow('Email', p.email), drawerRow('Phone', p.phone), drawerRow('Status', p.status)] })
        if (p.role === 'Tenant') {
          const theirs = db.leases.filter((l) => (l.tenantIds || '').includes(p.id))
          if (theirs.length) sections.push({ title: 'Leases', rows: theirs.map((l) => drawerRow(l.status || '—', short(l.property) + ' · ' + (l.start || '') + ' → ' + (l.end || ''), { onClick: () => setDrawer({ kind: 'lease', id: l.id }) })) })
        }
        if (p.role === 'Client') {
          const pfs = db.portfolios.filter((pf) => (pf.ownerIds || '').includes(p.id))
          if (pfs.length) sections.push({ title: 'Portfolios', rows: pfs.map((pf) => drawerRow(pf.status || '—', pf.name, { onClick: () => setDrawer({ kind: 'portfolio', id: pf.id }) })) })
          const owned = db.properties.filter((x) => x.ownerId === p.id)
          if (owned.length) sections.push({ title: 'Properties (' + owned.length + ')', rows: owned.slice(0, 12).map((x) => drawerRow(x.status || '—', short(x.address), { onClick: () => setDrawer({ kind: 'property', id: x.id }) })) })
        }
      }
    }

    if (drawer.kind === 'portfolio') {
      const pf = db.portfolios.find((x) => x.id === drawer.id)
      if (!pf) found = false
      else {
        title = pf.name; kindLabel = 'Portfolio · ' + (pf.status || '')
        const owners = (pf.ownerIds || '').split(',').map((s) => s.trim()).filter(Boolean).map((i) => peopleById.get(i)).filter(Boolean) as CanaryPerson[]
        sub = owners.map((o) => o.name).join(', ')
        sections.push({ title: 'Terms', rows: [drawerRow('Status', pf.status), drawerRow('Start date', pf.startDate)] })
        if (owners.length) sections.push({ title: 'Owners', rows: owners.map((o) => drawerRow(o.role, o.name + (o.email ? ' · ' + o.email : ''), { onClick: () => setDrawer({ kind: 'person', id: o.id }) })) })
        const pprops = db.properties.filter((p) => p.portfolioId === pf.id)
        sections.push({ title: 'Properties (' + pprops.length + ')', rows: pprops.map((p) => drawerRow(p.status || '—', short(p.address), { onClick: () => setDrawer({ kind: 'property', id: p.id }) })) })
      }
    }

    if (found) drawerVals = { open: true, kind: kindLabel, title, sub, sections, actions }
  }

  // ---------- draft composer derived ----------
  const propOptions = db.properties.map((p) => ({ id: p.id, short: short(p.address) }))
  const curDraft: DraftForm = draft ?? { id: null, propId: '', rent: '', start: '', end: '', beds: '', baths: '', parking: '', pets: 'No pets', utilities: 'Not included', description: '', published: false }
  const setDraftField = (k: keyof DraftForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setDraft({ ...curDraft, [k]: e.target.value })

  const curPayForm: PayFormState = payForm ?? emptyPayForm()
  const setPayField = (k: keyof PayFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPayForm({ ...curPayForm, [k]: e.target.value } as PayFormState)

  const chatSuggestions = [
    'Which leases expire in the next 90 days without a renewal lined up?',
    'What are my vacant properties and their asking rents?',
    'Summarize open maintenance projects by priority',
    'Which portfolio has the most properties?',
  ]

  const homeKpis = kpis.filter((k) => k.label !== 'Occupancy' && k.label !== 'Monthly rent roll')

  // ============================================================ render
  return (
    <div className="cnry" data-theme={theme} style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Instrument Sans', system-ui, sans-serif", fontSize: '14.5px', lineHeight: 1.45, display: 'flex' }}>

      {/* ============ SIDEBAR ============ */}
      <aside style={{ flex: 'none', width: sidebarCollapsed ? 64 : 210, background: 'var(--panel)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', zIndex: 45, transition: 'width .18s ease' }}>
        <button className="cy-hov" onClick={() => { setView('home'); setDrawer(null) }} title="Home" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', height: 57, border: 'none', borderBottom: '1px solid var(--border)', background: 'none', cursor: 'pointer', overflow: 'hidden', width: '100%', textAlign: 'left' }}>
          <span style={{ width: 34, height: 34, flex: 'none', position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo-white.png" alt="Canary — home" style={{ position: 'absolute', inset: 0, width: 34, height: 34, objectFit: 'contain', display: theme === 'dark' ? 'block' : 'none' }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo-black.png" alt="" style={{ position: 'absolute', inset: 0, width: 34, height: 34, objectFit: 'contain', display: theme === 'dark' ? 'none' : 'block' }} />
          </span>
          {!sidebarCollapsed && (
            <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-.01em', whiteSpace: 'nowrap', color: 'var(--text)' }}>Canary <span style={{ color: 'var(--dim)', fontWeight: 500 }}>PM</span></div>
          )}
        </button>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 10px', flex: 1, overflowY: 'auto' }}>
          {navItems.map((n) => (
            <button key={n.key} className="cy-hov" title={n.label} onClick={() => { setView(n.key); setDrawer(null) }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', cursor: 'pointer', padding: '10px 11px', borderRadius: 10, fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', background: view === n.key ? 'var(--elev)' : 'transparent', color: view === n.key ? 'var(--accent)' : 'var(--dim)' }}>
              <span style={{ display: 'flex', flex: 'none', alignItems: 'center', justifyContent: 'center', width: 20 }}><Icon paths={ICONS[n.key]} /></span>
              {!sidebarCollapsed && <span>{n.label}</span>}
            </button>
          ))}
        </nav>
        <button className="cy-hov" onClick={() => { const v = !sidebarCollapsed; setSidebarCollapsed(v); try { localStorage.setItem('canary_sidebar', v ? '1' : '0') } catch { /* ignore */ } }} title="Collapse menu" style={{ display: 'flex', alignItems: 'center', gap: 12, border: 'none', borderTop: '1px solid var(--border)', background: 'none', cursor: 'pointer', padding: '12px 15px', color: 'var(--dim)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <span style={{ display: 'flex', flex: 'none', width: 20, justifyContent: 'center', fontSize: 16 }}>{sidebarCollapsed ? '»' : '«'}</span>
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* ============ TOP BAR ============ */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 18px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 40 }}>
          <button className="cy-hov" onClick={() => setSidebarCollapsed((v) => !v)} title="Toggle menu" style={{ border: '1px solid var(--border)', background: 'var(--panel)', borderRadius: 9, padding: '8px 11px', cursor: 'pointer', fontSize: 15, lineHeight: 1, color: 'var(--dim)', flex: 'none' }}>☰</button>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search property, tenant, person…" style={{ flex: '1 1 160px', minWidth: 140, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 13px', outline: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {canSwitchRoles ? (
              <select value={role} onChange={(e) => onRoleChange(e.target.value as CanaryRole)} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Owner">Owner portal</option>
                <option value="Tenant">Tenant portal</option>
                <option value="Vendor">Vendor view</option>
              </select>
            ) : (
              <span style={{ color: 'var(--dim)', fontWeight: 600, fontSize: 13, border: '1px solid var(--border)', background: 'var(--panel)', borderRadius: 9, padding: '8px 12px', whiteSpace: 'nowrap' }}>{userName}</span>
            )}
            <a href="/listings" style={{ textDecoration: 'none', color: 'var(--dim)', border: '1px solid var(--border)', background: 'var(--panel)', borderRadius: 9, padding: '8px 12px', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>Public site ↗</a>
            <button onClick={() => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); try { localStorage.setItem('canary_theme', t) } catch { /* ignore */ } }} title="Toggle light / dark" style={{ border: '1px solid var(--border)', background: 'var(--panel)', borderRadius: 9, padding: '8px 11px', cursor: 'pointer', fontSize: 14 }}>{theme === 'dark' ? '☀' : '☾'}</button>
            <button onClick={signOut} title="Sign out" style={{ border: '1px solid var(--border)', background: 'var(--panel)', borderRadius: 9, padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--dim)', whiteSpace: 'nowrap' }}>Sign out</button>
            {priv && (
              <button className="cy-accent-btn" onClick={() => startDraftFor(null)} style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 9, padding: '9px 15px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Lease</button>
            )}
          </div>
        </header>

        {/* ============ ROLE BANNER ============ */}
        {!priv && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 18px', background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontFamily: MONO, fontSize: '11.5px', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>{roleBanner.label}</span>
            {canSwitchRoles ? (
              <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} style={{ background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', maxWidth: 320 }}>
                {personaOptions.map((po) => (<option key={po.id} value={po.id}>{po.label}</option>))}
              </select>
            ) : (
              <span style={{ fontWeight: 600 }}>{userName}</span>
            )}
            <span style={{ color: 'var(--dim)', fontSize: 13 }}>{roleBanner.note}</span>
          </div>
        )}

        <main style={{ padding: '14px 10px', width: '100%', margin: 0 }}>

          {/* ============ VIEW SWITCHER + QUICK SORT ============ */}
          {pdef && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 2, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
                {pdef.views.map((v) => (
                  <button key={v} onClick={() => setPageViews((s) => ({ ...s, [page]: v }))} style={{ border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', background: curView === v ? 'var(--elev)' : 'transparent', color: curView === v ? 'var(--accent)' : 'var(--dim)' }}>{viewLabels[v]}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <span style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--faint)' }}>Sort</span>
                <select value={curSort?.key ?? ''} onChange={(e) => setSort(e.target.value, curSort?.dir ?? 'asc')} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', fontSize: 13, cursor: 'pointer' }}>
                  <option value="">Default order</option>
                  {pdef.cols.map((c) => (<option key={c.key} value={c.key}>{c.label}</option>))}
                </select>
                <button onClick={() => { if (curSort) setSort(curSort.key, curSort.dir === 'asc' ? 'desc' : 'asc') }} title="Toggle sort direction" style={{ border: '1px solid var(--border)', background: 'var(--panel)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 13, color: 'var(--dim)' }}>{curSort?.dir === 'desc' ? '↓ desc' : '↑ asc'}</button>
              </div>
            </div>
          )}

          {/* ============ HOME · CHAT WITH DATA ============ */}
          {view === 'home' && (
            <section style={{ maxWidth: 920, margin: '0 auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
                {homeKpis.map((hk) => (
                  <div key={hk.label} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px' }}>
                    <div style={{ ...monoLabel, marginBottom: 4 }}>{hk.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: hk.color }}>{hk.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: '56vh' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: chatBusy ? 'var(--amber)' : 'var(--green)' }} />
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Ask Canary</div>
                  <span style={{ color: 'var(--faint)', fontSize: '12.5px' }}>{chatBusy ? 'thinking…' : 'connected to your live data'}</span>
                  {!!chat.length && (
                    <button onClick={() => setChat([])} style={{ marginLeft: 'auto', border: '1px solid var(--border)', background: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'var(--dim)', fontSize: '12.5px' }}>Clear</button>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {!chat.length && !chatBusy && (
                    <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 520, padding: '20px 0' }}>
                      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>What would you like to know?</div>
                      <div style={{ color: 'var(--dim)', fontSize: 14, marginBottom: 18 }}>Ask anything about your properties, leases, people, or projects — answers come straight from your live data.</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                        {chatSuggestions.map((s) => (
                          <button key={s} className="cy-sug" onClick={() => sendChat(s)} style={{ border: '1px solid var(--border)', background: 'var(--elev)', color: 'var(--text)', borderRadius: 10, padding: '10px 14px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {chat.map((cm, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: cm.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: cm.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: cm.role === 'user' ? 'var(--accent)' : 'var(--elev)', color: cm.role === 'user' ? 'var(--accent-text)' : 'var(--text)', border: cm.role === 'user' ? 'none' : '1px solid var(--border)', fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{cm.text}</div>
                    </div>
                  ))}
                  {chatBusy && (
                    <div style={{ display: 'flex' }}><div style={{ padding: '10px 14px', borderRadius: '12px 12px 12px 4px', background: 'var(--elev)', border: '1px solid var(--border)', color: 'var(--dim)', fontSize: '13.5px' }}>Looking at your data…</div></div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
                  <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendChat(chatInput) }} placeholder="e.g. Which leases end this fall without a renewal?" style={{ flex: 1, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', outline: 'none' }} />
                  <button className="cy-accent-btn" onClick={() => sendChat(chatInput)} style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 10, padding: '11px 18px', fontWeight: 700, cursor: 'pointer' }}>{chatBusy ? '…' : 'Ask'}</button>
                </div>
              </div>
            </section>
          )}

          {/* ============ DASHBOARD ============ */}
          {view === 'dashboard' && (
            <section>
              {topProject && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'var(--panel)', border: '1px solid var(--red)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
                  <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', padding: '4px 10px', borderRadius: 7, background: 'var(--red)', color: 'var(--red-text)' }}>TOP PRIORITY</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topProject.name}</div>
                    <div style={{ color: 'var(--dim)', fontSize: '12.5px' }}>{[short(topProject.property), topProject.status, topProject.priority].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button className="cy-hov" onClick={() => setView('projects')} style={{ flex: 'none', border: '1px solid var(--border)', background: 'var(--elev)', color: 'var(--text)', borderRadius: 9, padding: '8px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>View projects →</button>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
                {kpis.map((k) => (
                  <div key={k.label} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ ...monoLabel, marginBottom: 6 }}>{k.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Expiring soon · no renewal</div>
                    <button onClick={() => setView('leases')} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Timeline →</button>
                  </div>
                  {dashExpiring.map((l) => (
                    <div key={l.id} className="cy-hov" onClick={() => setDrawer({ kind: 'lease', id: l.id })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 9, cursor: 'pointer' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: 'var(--red)', flex: 'none' }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.short}</div>
                        <div style={{ color: 'var(--dim)', fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.tenants}</div>
                      </div>
                      <div style={{ textAlign: 'right', flex: 'none' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{l.endLabel}</div>
                        <div style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }}>{l.daysLeft}</div>
                      </div>
                    </div>
                  ))}
                  {!dashExpiring.length && <div style={{ color: 'var(--dim)', padding: 8 }}>Nothing expiring without a renewal. 🎉</div>}
                </div>
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Vacant properties</div>
                    <button onClick={() => setView('properties')} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>All properties →</button>
                  </div>
                  {dashVacant.map((p) => (
                    <div key={p.id} className="cy-hov" onClick={() => setDrawer({ kind: 'property', id: p.id })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 9, cursor: 'pointer' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: 'var(--amber)', flex: 'none' }} />
                      <div style={{ minWidth: 0, flex: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.short}</div>
                      <div style={{ color: 'var(--dim)', fontSize: '12.5px', flex: 'none' }}>{p.meta}</div>
                    </div>
                  ))}
                  {!dashVacant.length && <div style={{ color: 'var(--dim)', padding: 8 }}>No vacancies right now.</div>}
                </div>
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Open projects</div>
                    <button onClick={() => setView('projects')} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>All projects →</button>
                  </div>
                  {dashProjects.map((pr) => (
                    <div key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 9 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: 'var(--blue)', flex: 'none' }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.name}</div>
                        <div style={{ color: 'var(--dim)', fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{short(pr.property)}</div>
                      </div>
                      <span style={{ flex: 'none', fontSize: '11.5px', fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'var(--elev)', border: '1px solid var(--border)', color: 'var(--dim)', whiteSpace: 'nowrap' }}>{pr.status}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Draft listings</div>
                    {priv && <button onClick={() => startDraftFor(null)} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ New draft</button>}
                  </div>
                  {dashDrafts.map((d) => (
                    <div key={d.id} className="cy-hov" onClick={() => openDraft(d)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 9, cursor: 'pointer' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, border: '2px solid var(--accent)', flex: 'none' }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{short(d.address)}</div>
                        <div style={{ color: 'var(--dim)', fontSize: '12.5px' }}>{(d.rent ? '$' + d.rent + '/mo · ' : '') + (d.start || 'no date')}</div>
                      </div>
                      <span style={{ flex: 'none', fontSize: '11.5px', fontWeight: 700, padding: '3px 8px', borderRadius: 6, color: d.published ? 'var(--green)' : 'var(--dim)', border: '1px solid var(--border)', background: 'var(--elev)' }}>{d.published ? 'PUBLIC' : 'DRAFT'}</span>
                    </div>
                  ))}
                  {!dashDrafts.length && (
                    <div style={{ color: 'var(--dim)', padding: 8, fontSize: '13.5px' }}>No draft leases yet. Start one from a property or the <b>+ Lease</b> button — published drafts appear on the public site.</div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ============ LEASES TIMELINE ============ */}
          {view === 'leases' && showDefault && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {filterMeta.map((f) => (
                    <button key={f.key} onClick={() => setTlStatusFilter({ ...filt, [f.key]: !filt[f.key] })} style={{ border: `1px solid ${filt[f.key] ? 'var(--border2)' : 'var(--border)'}`, background: filt[f.key] ? 'var(--elev)' : 'transparent', color: filt[f.key] ? 'var(--text)' : 'var(--faint)', borderRadius: 8, padding: '6px 11px', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: f.dot }} />{f.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setTlAnchor(todayMid.getTime() - Math.round(spanDays / 4) * DAY)} style={{ border: '1px solid var(--border)', background: 'var(--panel)', borderRadius: 9, padding: '8px 14px', fontWeight: 600, cursor: 'pointer' }}>Today</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 9, padding: 3 }}>
                  <button onClick={() => { setTlZoomIdx(Math.max(0, zoomIdx - 1)); setTlAnchor(winStart.getTime()) }} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '5px 10px', color: 'var(--dim)', fontSize: 15 }}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)', padding: '0 4px' }}>{TL_ZOOM_PRESETS[zoomIdx].label}</span>
                  <button onClick={() => { setTlZoomIdx(Math.min(TL_ZOOM_PRESETS.length - 1, zoomIdx + 1)); setTlAnchor(winStart.getTime()) }} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '5px 10px', color: 'var(--dim)', fontSize: 15 }}>+</button>
                </div>
                <button onClick={() => setTlAnchor(winStart.getTime() - spanDays * DAY)} style={{ border: '1px solid var(--border)', background: 'var(--panel)', borderRadius: 9, padding: '8px 12px', cursor: 'pointer', color: 'var(--dim)' }}>←</button>
                <button onClick={() => setTlAnchor(winStart.getTime() + spanDays * DAY)} style={{ border: '1px solid var(--border)', background: 'var(--panel)', borderRadius: 9, padding: '8px 12px', cursor: 'pointer', color: 'var(--dim)' }}>→</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
                {kpis.map((k) => (
                  <div key={k.label} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ ...monoLabel, fontSize: 10 }}>{k.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: 760 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'clamp(150px,20vw,250px) 1fr', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 8 }}>Property <span style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', fontSize: 10 }}>⇅ lease end</span></div>
                      <div style={{ position: 'relative', height: 38 }}>
                        {tlTicks.map((t, i) => (
                          <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: t.left, borderLeft: '1px solid var(--border)', padding: '10px 0 0 8px', fontFamily: MONO, fontSize: 11, color: 'var(--dim)', letterSpacing: '.06em', fontWeight: t.weight }}>{t.label}</div>
                        ))}
                      </div>
                    </div>
                    <div style={{ maxHeight: '62vh', overflowY: 'auto', position: 'relative' }}>
                      {tlRows.map((r) => (
                        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'clamp(150px,20vw,250px) 1fr', borderBottom: '1px solid var(--border)', minHeight: 56 }}>
                          <div className="cy-hov" onClick={() => setDrawer({ kind: 'property', id: r.id })} style={{ padding: '9px 14px', cursor: 'pointer', borderRight: '1px solid var(--border)', minWidth: 0 }}>
                            <div style={{ fontWeight: 650, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.short}</div>
                            <div style={{ color: 'var(--dim)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</div>
                          </div>
                          <div style={{ position: 'relative', overflow: 'hidden' }}>
                            {tlTicks.map((t, i) => (
                              <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: t.left, borderLeft: '1px solid var(--border)', opacity: 0.55 }} />
                            ))}
                            <div style={{ position: 'absolute', top: 0, bottom: 0, left: tlTodayLeft, borderLeft: '2px solid var(--red)', opacity: 0.7 }} />
                            {r.bars.map((b, i) => (
                              <div key={i} onClick={b.onClick} title={b.title} style={{ position: 'absolute', top: 12, height: 30, left: b.left, width: b.width, background: b.bg, color: b.color, border: b.borderStyle, borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 10px', fontWeight: 650, fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }}>{b.label}</div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {!tlRows.length && <div style={{ padding: 24, color: 'var(--dim)' }}>No properties match.</div>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>SCRUB</span>
                  <input type="range" min={-1095} max={1825} step={1} value={tlSliderOffset} onChange={(e) => setTlAnchor(todayMid.getTime() + parseInt(e.target.value, 10) * DAY)} style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none', minWidth: 44, textAlign: 'right' }}>{(tlSliderOffset > 0 ? '+' : '') + tlSliderOffset + 'd'}</span>
                </div>
              </div>
            </section>
          )}

          {/* ============ PROPERTIES ============ */}
          {view === 'properties' && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {statuses.map((st) => (
                  <button key={st || 'all'} onClick={() => setPropFilter(st)} style={{ border: `1px solid ${propFilter === st ? 'var(--border2)' : 'var(--border)'}`, background: propFilter === st ? 'var(--elev)' : 'transparent', color: propFilter === st ? 'var(--text)' : 'var(--dim)', borderRadius: 8, padding: '6px 12px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{st || 'All'}</button>
                ))}
                <span style={{ color: 'var(--dim)', fontSize: 13, marginLeft: 'auto' }}>{filteredProps.length + ' of ' + props.length}</span>
              </div>
              {showDefault && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 12 }}>
                  {(genRows as CanaryProperty[]).map((p) => {
                    const [chipBg, chipColor] = chipFor(p.status)
                    return (
                      <div key={p.id} className="cy-hov-card" onClick={() => setDrawer({ kind: 'property', id: p.id })} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: '15px 16px', cursor: 'pointer', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, minWidth: 0 }}>{short(p.address)}</div>
                          <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', padding: '3px 9px', borderRadius: 6, background: chipBg, color: chipColor }}>{p.status || '—'}</span>
                        </div>
                        <div style={{ color: 'var(--dim)', fontSize: '12.5px', margin: '2px 0 10px' }}>{[p.city, p.area].filter(Boolean).join(' · ') || p.address.split(',').slice(1, 2).join('').trim()}</div>
                        <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--dim)', flexWrap: 'wrap' }}>
                          <span><b style={{ color: 'var(--text)' }}>{p.beds || '—'}</b> bed</span>
                          <span><b style={{ color: 'var(--text)' }}>{p.baths || '—'}</b> bath</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--text)' }}>{p.rate ? money(p.rate) + '/mo' : ''}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {/* ============ PEOPLE ============ */}
          {view === 'people' && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {roles.map((r) => (
                  <button key={r || 'all'} onClick={() => setPeopleRole(r)} style={{ border: `1px solid ${peopleRole === r ? 'var(--border2)' : 'var(--border)'}`, background: peopleRole === r ? 'var(--elev)' : 'transparent', color: peopleRole === r ? 'var(--text)' : 'var(--dim)', borderRadius: 8, padding: '6px 12px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    {r || 'All'} <span style={{ opacity: 0.6, fontFamily: MONO, fontSize: 11 }}>{r ? String(roleCounts[r] || 0) : String(scoped.people.length)}</span>
                  </button>
                ))}
                <span style={{ color: 'var(--dim)', fontSize: 13, marginLeft: 'auto' }}>{filteredPeople.length + ' people'}</span>
              </div>
              {showDefault && (
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                  {(genRows as CanaryPerson[]).slice(0, 120).map((pe) => (
                    <div key={pe.id} className="cy-hov" onClick={() => setDrawer({ kind: 'person', id: pe.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', minWidth: 0 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--elev)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, color: 'var(--dim)', flex: 'none' }}>{(pe.name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</div>
                      <div style={{ minWidth: 0, flex: 2 }}>
                        <div style={{ fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pe.name || '—'}</div>
                        <div style={{ color: 'var(--dim)', fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pe.email}</div>
                      </div>
                      <div style={{ flex: 1, color: 'var(--dim)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pe.phone}</div>
                      <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'var(--elev)', border: '1px solid var(--border)', color: 'var(--dim)' }}>{pe.role}</span>
                      <span style={{ flex: 'none', fontSize: '11.5px', color: /current|active/i.test(pe.status || '') ? 'var(--green)' : 'var(--faint)', fontWeight: 600, minWidth: 78, textAlign: 'right' }}>{pe.status}</span>
                    </div>
                  ))}
                  {filteredPeople.length > 120 && <div style={{ padding: '12px 16px', color: 'var(--dim)', fontSize: 13 }}>Showing 120 of {filteredPeople.length} — refine with search.</div>}
                </div>
              )}
            </section>
          )}

          {/* ============ PORTFOLIOS ============ */}
          {view === 'portfolios' && showDefault && (
            <section>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))', gap: 12 }}>
                {(genRows as CanaryPortfolio[]).map((pc) => {
                  const active = pc.status === 'Active'
                  return (
                    <div key={pc.id} className="cy-hov-card" onClick={() => setDrawer({ kind: 'portfolio', id: pc.id })} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: '15px 16px', cursor: 'pointer', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, minWidth: 0 }}>{pc.name}</div>
                        <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: active ? 'var(--green)' : 'var(--elev)', color: active ? 'var(--green-text)' : 'var(--dim)' }}>{pc.status || '—'}</span>
                      </div>
                      <div style={{ color: 'var(--dim)', fontSize: '12.5px', margin: '3px 0 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pfOwnersOf(pc) || '—'}</div>
                      <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--dim)' }}>
                        <span><b style={{ color: 'var(--text)' }}>{props.filter((p) => p.portfolioId === pc.id).length}</b> properties</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ============ PAYMENTS ============ */}
          {view === 'payments' && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <select value={payCat} onChange={(e) => setPayCat(e.target.value)} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px' }}>
                  <option value="">All categories</option>
                  {PAY_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
                <select value={payType} onChange={(e) => setPayType(e.target.value)} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px' }}>
                  <option value="">Credit + Debit</option>
                  <option value="Credit">Credit</option>
                  <option value="Debit">Debit</option>
                </select>
                <span style={{ color: 'var(--dim)', fontSize: 13 }}>{filteredPay.length + ' transactions'}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--dim)' }}>Net <b style={{ color: payNetN < 0 ? 'var(--red)' : 'var(--green)', fontSize: 15 }}>{money(Math.abs(payNetN)) || '$0'}</b></span>
                  {priv && <button onClick={() => { setPayForm(curPayForm); setPayFormOpen((v) => !v); setPayError('') }} style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 9, padding: '9px 14px', fontWeight: 700, cursor: 'pointer' }}>+ Payment</button>}
                </div>
              </div>

              {payFormOpen && (
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, alignItems: 'end' }}>
                    <label style={{ display: 'block', minWidth: 0 }}><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Date</span><input type="date" value={curPayForm.date} onChange={setPayField('date')} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 4 }} /></label>
                    <label style={{ display: 'block', minWidth: 0 }}><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Property</span>
                      <select value={curPayForm.property} onChange={setPayField('property')} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
                        <option value="">— select —</option>
                        {propOptions.map((o) => (<option key={o.id} value={o.id}>{o.short}</option>))}
                      </select></label>
                    <label style={{ display: 'block', minWidth: 0 }}><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Category</span>
                      <select value={curPayForm.category} onChange={setPayField('category')} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
                        {PAY_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                      </select></label>
                    <label style={{ display: 'block', minWidth: 0 }}><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Description</span><input value={curPayForm.description} onChange={setPayField('description')} placeholder="e.g. June rent" style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 4 }} /></label>
                    <label style={{ display: 'block', minWidth: 0 }}><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Amount $</span><input type="number" value={curPayForm.amount} onChange={setPayField('amount')} placeholder="0.00" style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 4 }} /></label>
                    <label style={{ display: 'block', minWidth: 0 }}><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Type</span>
                      <select value={curPayForm.type} onChange={setPayField('type')} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
                        <option value="Credit">Credit</option><option value="Debit">Debit</option>
                      </select></label>
                    <button onClick={submitPayment} disabled={paySaving} style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 9, padding: '10px 14px', fontWeight: 700, cursor: 'pointer', opacity: paySaving ? 0.6 : 1 }}>{paySaving ? 'Saving…' : 'Save'}</button>
                  </div>
                  {payError && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{payError}</div>}
                </div>
              )}
            </section>
          )}

          {/* ============ PROJECTS ============ */}
          {view === 'projects' && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {projStatuses.map((st) => (
                  <button key={st || 'all'} onClick={() => setProjFilter(st)} style={{ border: `1px solid ${projFilter === st ? 'var(--border2)' : 'var(--border)'}`, background: projFilter === st ? 'var(--elev)' : 'transparent', color: projFilter === st ? 'var(--text)' : 'var(--dim)', borderRadius: 8, padding: '6px 12px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    {st || 'All'} <span style={{ opacity: 0.6, fontFamily: MONO, fontSize: 11 }}>{st ? String(pjCounts[st] || 0) : String(scoped.projects.length)}</span>
                  </button>
                ))}
              </div>
              {showDefault && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
                  {(genRows as CanaryProject[]).map((pj) => (
                    <div key={pj.id} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: '15px 16px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, minWidth: 0 }}>{pj.name || 'Untitled'}</div>
                        <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'var(--elev)', border: '1px solid var(--border)', color: projStatusColor(pj) }}>{pj.status || '—'}</span>
                      </div>
                      <div style={{ color: 'var(--dim)', fontSize: '12.5px', marginBottom: 8 }}>{short(pj.property)} · {pj.priority || 'No priority'}</div>
                      <div style={{ color: 'var(--dim)', fontSize: 13, maxHeight: 60, overflow: 'hidden' }}>{(pj.description || '').slice(0, 180)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ============ GENERIC TABLE VIEW ============ */}
          {showTable && pdef && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 760 }}>
                  <div style={{ display: 'flex', gap: 12, padding: '4px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    {pdef.cols.map((c) => (
                      <button key={c.key} className="cy-col-head" title={'Sort by ' + c.label} onClick={() => setSort(c.key, curSort && curSort.key === c.key && curSort.dir === 'asc' ? 'desc' : 'asc')} style={{ flex: c.flex, minWidth: 0, border: 'none', background: 'none', cursor: 'pointer', padding: '7px 0', textAlign: (c.align || 'left') as 'left' | 'right', fontFamily: MONO, fontSize: '10.5px', letterSpacing: '.09em', textTransform: 'uppercase', color: curSort && curSort.key === c.key ? 'var(--text)' : 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.label} {curSort && curSort.key === c.key ? (curSort.dir === 'desc' ? '↓' : '↑') : ''}
                      </button>
                    ))}
                  </div>
                  {genRows.slice(0, tblCap).map((r, ri) => {
                    const open = pdef.open ? pdef.open(r) : null
                    return (
                      <div key={ri} className={open ? 'cy-hov' : undefined} onClick={open ?? undefined} style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center', fontSize: '13.5px', cursor: open ? 'pointer' : 'default', minWidth: 0 }}>
                        {pdef.cols.map((c) => (
                          <span key={c.key} style={{ flex: c.flex, minWidth: 0, textAlign: (c.align || 'left') as 'left' | 'right', color: c.color ? c.color(r) : c.dim ? 'var(--dim)' : 'var(--text)', fontWeight: c.bold ? 650 : 400, fontFamily: c.mono ? MONO : 'inherit', fontSize: c.mono ? 12 : '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(c.get(r))}</span>
                        ))}
                      </div>
                    )
                  })}
                  {!genRows.length && (
                    <div style={{ padding: '28px 20px', color: 'var(--dim)', fontSize: '13.5px' }}>
                      {page === 'payments' ? 'Ledger is empty — add entries with + Payment, or record rent payments from leases.' : 'Nothing matches your filters.'}
                    </div>
                  )}
                  {genRows.length > tblCap && <div style={{ padding: '12px 16px', color: 'var(--dim)', fontSize: 13 }}>Showing {tblCap} of {genRows.length} — refine with search.</div>}
                </div>
              </div>
            </div>
          )}

          {/* ============ GENERIC KANBAN VIEW ============ */}
          {showKanban && (
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 10 }}>
              {kanCols.map((kc) => (
                <div key={kc.title} style={{ flex: '0 0 272px', minWidth: 0, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '2px 4px 10px' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kc.title}</span>
                    <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--dim)', background: 'var(--elev)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 7px' }}>{kc.count}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {kc.cards.map((kd, i) => (
                      <div key={i} className="cy-hov-border" onClick={kd.onClick ?? undefined} style={{ background: 'var(--elev)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 12px', cursor: kd.onClick ? 'pointer' : 'default', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontWeight: 650, fontSize: '13.5px', minWidth: 0 }}>{kd.title}</span>
                          <span style={{ flex: 'none', fontWeight: 700, fontSize: '12.5px', color: kd.rightColor }}>{kd.right}</span>
                        </div>
                        <div style={{ color: 'var(--dim)', fontSize: 12, marginTop: 3 }}>{kd.sub}</div>
                      </div>
                    ))}
                    {kc.more && <div style={{ color: 'var(--faint)', fontSize: 12, padding: '2px 4px' }}>{kc.moreLabel}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ============ PROJECTS GANTT VIEW ============ */}
          {showGantt && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', color: 'var(--dim)', fontSize: '12.5px' }}>Projected schedule — no start/end dates are on file yet, so bars are estimated from status and priority.</div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 760 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'clamp(170px,22vw,280px) 1fr', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Project</div>
                    <div style={{ position: 'relative', height: 38 }}>
                      {gTicks.map((gt, i) => (
                        <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: gt.left, borderLeft: '1px solid var(--border)', padding: '10px 0 0 8px', fontFamily: MONO, fontSize: 11, color: 'var(--dim)', letterSpacing: '.06em' }}>{gt.label}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ maxHeight: '62vh', overflowY: 'auto' }}>
                    {gRows.map((gr, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: 'clamp(170px,22vw,280px) 1fr', borderBottom: '1px solid var(--border)', minHeight: 52 }}>
                        <div style={{ padding: '8px 14px', borderRight: '1px solid var(--border)', minWidth: 0 }}>
                          <div style={{ fontWeight: 650, fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gr.name}</div>
                          <div style={{ color: 'var(--dim)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gr.sub}</div>
                        </div>
                        <div style={{ position: 'relative', overflow: 'hidden' }}>
                          {gTicks.map((gt, gi) => (
                            <div key={gi} style={{ position: 'absolute', top: 0, bottom: 0, left: gt.left, borderLeft: '1px solid var(--border)', opacity: 0.55 }} />
                          ))}
                          <div style={{ position: 'absolute', top: 0, bottom: 0, left: gTodayLeft, borderLeft: '2px solid var(--red)', opacity: 0.7 }} />
                          <div title={gr.title} style={{ position: 'absolute', top: 11, height: 28, left: gr.left, width: gr.width, background: gr.bg, color: gr.color, borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 10px', fontWeight: 650, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}>{gr.barLabel}</div>
                        </div>
                      </div>
                    ))}
                    {!gRows.length && <div style={{ padding: 24, color: 'var(--dim)' }}>No projects match.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ============ DRAWER (detail panel) ============ */}
      {drawerVals.open && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,6,.55)', zIndex: 60, backdropFilter: 'blur(2px)' }} />
          <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(480px,94vw)', background: 'var(--panel)', borderLeft: '1px solid var(--border2)', zIndex: 61, boxShadow: 'var(--shadow)', overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>{drawerVals.kind}</div>
                <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-.01em' }}>{drawerVals.title}</div>
                <div style={{ color: 'var(--dim)', fontSize: 13 }}>{drawerVals.sub}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ border: '1px solid var(--border)', background: 'var(--elev)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--dim)', flex: 'none' }}>✕</button>
            </div>
            {drawerVals.actions.map((da) => (
              <button key={da.label} className="cy-accent-btn" onClick={da.onClick} style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 9, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', margin: '6px 8px 6px 0' }}>{da.label}</button>
            ))}
            {drawerVals.sections.map((ds, si) => (
              <div key={si} style={{ marginTop: 16 }}>
                <div style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>{ds.title}</div>
                {ds.rows.map((dr, ri) => (
                  <div key={ri} className={dr.onClick ? 'cy-hov' : undefined} onClick={dr.onClick ?? undefined} style={{ display: 'flex', gap: 12, padding: '6px 4px', fontSize: '13.5px', borderRadius: 7, cursor: dr.onClick ? 'pointer' : 'default' }}>
                    <span style={{ flex: '0 0 128px', color: 'var(--dim)' }}>{dr.k}</span>
                    <span style={{ flex: 1, fontWeight: 600, color: dr.vColor, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{dr.v}</span>
                  </div>
                ))}
              </div>
            ))}
          </aside>
        </>
      )}

      {/* ============ DRAFT LEASE COMPOSER ============ */}
      {draftOpen && (
        <>
          <div onClick={() => { setDraftOpen(false); setDraft(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,6,.55)', zIndex: 70, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(680px,94vw)', maxHeight: '92vh', overflowY: 'auto', background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 18, zIndex: 71, boxShadow: 'var(--shadow)', padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>Draft lease · listing</div>
                <div style={{ fontWeight: 700, fontSize: 19 }}>{curDraft.id ? 'Edit draft — ' + short(curDraft.address || '') : 'New draft lease'}</div>
              </div>
              <button onClick={() => { setDraftOpen(false); setDraft(null) }} style={{ border: '1px solid var(--border)', background: 'var(--elev)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--dim)' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
              <label style={{ gridColumn: '1/-1', display: 'block' }}><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Property</span>
                <select value={curDraft.propId} onChange={(e) => {
                  const p = db.properties.find((x) => x.id === e.target.value)
                  if (p) startDraftFor(p, { start: curDraft.start, end: curDraft.end })
                  else setDraft({ ...curDraft, propId: '' })
                }} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', marginTop: 4 }}>
                  <option value="">— choose a property —</option>
                  {propOptions.map((o) => (<option key={o.id} value={o.id}>{o.short}</option>))}
                </select>
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>Static details (beds, baths, parking) auto-fill from the property record.</span></label>
              <label><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Monthly rent $</span><input type="number" value={curDraft.rent} onChange={setDraftField('rent')} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', marginTop: 4 }} /></label>
              <label><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Available / start</span><input type="date" value={curDraft.start} onChange={setDraftField('start')} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', marginTop: 4 }} /></label>
              <label><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Lease end</span><input type="date" value={curDraft.end} onChange={setDraftField('end')} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', marginTop: 4 }} /></label>
              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ flex: 1 }}><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Beds</span><input value={curDraft.beds} onChange={setDraftField('beds')} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', marginTop: 4 }} /></label>
                <label style={{ flex: 1 }}><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Baths</span><input value={curDraft.baths} onChange={setDraftField('baths')} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', marginTop: 4 }} /></label>
                <label style={{ flex: 1 }}><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Parking</span><input value={curDraft.parking} onChange={setDraftField('parking')} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', marginTop: 4 }} /></label>
              </div>
              <label><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Pets (owner preference)</span>
                <select value={curDraft.pets} onChange={setDraftField('pets')} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', marginTop: 4 }}>
                  <option>No pets</option><option>Pet friendly</option><option>Dog friendly</option><option>Cat friendly</option><option>By approval</option>
                </select></label>
              <label><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Utilities</span>
                <select value={curDraft.utilities} onChange={setDraftField('utilities')} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', marginTop: 4 }}>
                  <option>Not included</option><option>Included</option><option>Included with cap</option></select></label>
              <label style={{ gridColumn: '1/-1' }}><span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Public description <span style={{ color: 'var(--faint)', fontWeight: 500 }}>(shown to tenants — never include codes, keys, or owner info)</span></span>
                <textarea value={curDraft.description} onChange={setDraftField('description')} rows={3} style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', marginTop: 4, resize: 'vertical' }} /></label>
            </div>
            {draftError && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{draftError}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={() => setDraft({ ...curDraft, published: !curDraft.published })} style={{ border: `1px solid ${curDraft.published ? 'var(--green)' : 'var(--border)'}`, background: curDraft.published ? 'var(--green)' : 'transparent', color: curDraft.published ? 'var(--green-text)' : 'var(--dim)', borderRadius: 9, padding: '9px 14px', fontWeight: 700, cursor: 'pointer' }}>{curDraft.published ? '● Published to public site' : '○ Not published'}</button>
              <span style={{ fontSize: '12.5px', color: 'var(--dim)', flex: 1, minWidth: 180 }}>Published drafts appear on the public listings page with only tenant-safe fields.</span>
              {!!curDraft.id && <button onClick={removeDraft} disabled={draftSaving} style={{ border: '1px solid var(--border)', background: 'none', color: 'var(--red)', borderRadius: 9, padding: '9px 14px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>}
              <button className="cy-accent-btn" onClick={submitDraft} disabled={draftSaving} style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 9, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', opacity: draftSaving ? 0.6 : 1 }}>{draftSaving ? 'Saving…' : 'Save draft'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
