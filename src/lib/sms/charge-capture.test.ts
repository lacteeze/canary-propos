import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendChargeCaptureSms = vi.fn(async () => undefined)

vi.mock('./pingram-send', () => ({
  sendChargeCaptureSms: (...args: unknown[]) => sendChargeCaptureSms(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => getFakeAdmin(),
}))

type Draft = {
  id: string
  org_id: string
  person_id: string
  from_phone: string
  status: string
  original_text: string
  property_id: string | null
  candidate_properties: Array<{ id: string; street_address: string }>
  category: string | null
  note: string | null
  supplies_cost: number | null
  labour_hours: number | null
  computed: Record<string, number> | null
}

type Db = {
  pingramIds: string[]
  people: Array<{ id: string; org_id: string; phone: string; role: string[]; active: boolean }>
  orgs: Array<{
    id: string
    expense_markup_rate: number
    expense_labour_rate: number
    expense_hst_rate: number
  }>
  properties: Array<{ id: string; org_id: string; street_address: string }>
  drafts: Draft[]
  expenses: Array<Record<string, unknown>>
  phrases: Array<Record<string, unknown>>
}

let db: Db
let idSeq = 1

function nextId() {
  idSeq += 1
  return `uuid-${idSeq}`
}

function matchesFilters(row: Record<string, unknown>, filters: Record<string, unknown>) {
  for (const [k, v] of Object.entries(filters)) {
    if (k.endsWith('__in')) {
      const col = k.slice(0, -4)
      if (!Array.isArray(v) || !v.includes(row[col])) return false
      continue
    }
    if (row[k] !== v) return false
  }
  return true
}

function createQuery(table: string) {
  const state: {
    action: 'select' | 'insert' | 'update'
    filters: Record<string, unknown>
    payload: unknown
    mode: 'many' | 'maybe' | 'single'
  } = { action: 'select', filters: {}, payload: null, mode: 'many' }

  const rowsFor = (): Record<string, unknown>[] => {
    if (table === 'people') return db.people as unknown as Record<string, unknown>[]
    if (table === 'organizations') return db.orgs as unknown as Record<string, unknown>[]
    if (table === 'properties') return db.properties as unknown as Record<string, unknown>[]
    if (table === 'sms_charge_drafts') return db.drafts as unknown as Record<string, unknown>[]
    if (table === 'expenses') return db.expenses
    if (table === 'sms_charge_phrases') return db.phrases
    if (table === 'pingram_webhook_events') {
      return db.pingramIds.map((pingram_id) => ({ pingram_id }))
    }
    return []
  }

  const execute = () => {
    if (state.action === 'insert') {
      const row = state.payload as Record<string, unknown>
      if (table === 'pingram_webhook_events') {
        const id = String(row.pingram_id)
        if (db.pingramIds.includes(id)) {
          return { data: null, error: { code: '23505', message: 'duplicate' } }
        }
        db.pingramIds.push(id)
        return { data: row, error: null }
      }
      if (table === 'sms_charge_drafts') {
        const rec = { id: nextId(), ...row } as Draft
        db.drafts.push(rec)
        return { data: rec, error: null }
      }
      if (table === 'expenses') {
        const rec = { id: nextId(), ...row }
        db.expenses.push(rec)
        return { data: rec, error: null }
      }
      return { data: row, error: null }
    }
    if (state.action === 'update') {
      const targets = rowsFor().filter((r) => matchesFilters(r, state.filters))
      for (const t of targets) Object.assign(t, state.payload)
      return { data: targets, error: null }
    }
    const found = rowsFor().filter((r) => matchesFilters(r, state.filters))
    if (state.mode === 'maybe') return { data: found[0] ?? null, error: null }
    if (state.mode === 'single') return { data: found[0] ?? null, error: found[0] ? null : { message: 'not found' } }
    return { data: found, error: null }
  }

  const q: Record<string, unknown> = {
    select: () => q,
    insert: (row: unknown) => {
      state.action = 'insert'
      state.payload = row
      return q
    },
    update: (row: unknown) => {
      state.action = 'update'
      state.payload = row
      return q
    },
    eq: (col: string, val: unknown) => {
      state.filters[col] = val
      return q
    },
    in: (col: string, vals: unknown[]) => {
      state.filters[`${col}__in`] = vals
      return q
    },
    contains: () => q,
    overlaps: () => q,
    maybeSingle: () => {
      state.mode = 'maybe'
      return q
    },
    single: () => {
      state.mode = 'single'
      return q
    },
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(execute()).then(onFulfilled, onRejected),
  }
  return q
}

function getFakeAdmin() {
  return {
    from: (table: string) => createQuery(table),
  }
}

beforeEach(() => {
  idSeq = 1
  sendChargeCaptureSms.mockClear()
  db = {
    pingramIds: [],
    people: [
      {
        id: 'person-staff',
        org_id: 'org-1',
        phone: '709-555-0100',
        role: ['manager'],
        active: true,
      },
    ],
    orgs: [
      {
        id: 'org-1',
        expense_markup_rate: 0.3,
        expense_labour_rate: 50,
        expense_hst_rate: 0.15,
      },
    ],
    properties: [
      { id: 'prop-casey', org_id: 'org-1', street_address: "73 Casey Street, St. John's" },
      { id: 'prop-duck', org_id: 'org-1', street_address: '10 Duckworth St' },
    ],
    drafts: [],
    expenses: [],
    phrases: [],
  }
})

describe('handleInboundSms', () => {
  it('ignores unknown numbers with no SMS and no expense', async () => {
    const { handleInboundSms } = await import('./charge-capture')
    await handleInboundSms({
      from: '+17095550999',
      to: '+17095550000',
      text: 'Charge 73 Casey $100',
      pingramId: 'evt-unknown',
    })
    expect(sendChargeCaptureSms).not.toHaveBeenCalled()
    expect(db.expenses).toHaveLength(0)
  })

  it('drafts a unique-property bill-back without inserting an expense', async () => {
    const { handleInboundSms } = await import('./charge-capture')
    await handleInboundSms({
      from: '709-555-0100',
      to: '+17095550000',
      text: 'Charge 73 Casey $100',
      pingramId: 'evt-draft',
    })
    expect(db.expenses).toHaveLength(0)
    expect(db.drafts).toHaveLength(1)
    expect(db.drafts[0].status).toBe('pending_confirm')
    const msg = String(sendChargeCaptureSms.mock.calls[0]?.[0]?.message ?? '')
    expect(msg).toMatch(/Subtotal/)
    expect(msg).toMatch(/Total/)
    expect(msg).toMatch(/Y/)
    expect(msg).toMatch(/Labour 2h/)
  })

  it('posts once on Y from a pending_confirm draft', async () => {
    const { handleInboundSms } = await import('./charge-capture')
    await handleInboundSms({
      from: '709-555-0100',
      to: '+17095550000',
      text: 'Charge 73 Casey $100',
      pingramId: 'evt-1',
    })
    expect(db.expenses).toHaveLength(0)
    await handleInboundSms({
      from: '709-555-0100',
      to: '+17095550000',
      text: 'Y',
      pingramId: 'evt-2',
    })
    expect(db.expenses).toHaveLength(1)
    expect(db.expenses[0].source_channel).toBe('sms')
    expect(db.expenses[0].created_by).toBe('person-staff')
    expect(db.expenses[0].billed_amount).toBe(115)
    expect(db.expenses[0].source_sms_text).toBe('Charge 73 Casey $100')
    expect(db.drafts[0].status).toBe('posted')
  })

  it('does not duplicate when Y is sent after the draft is posted', async () => {
    const { handleInboundSms } = await import('./charge-capture')
    await handleInboundSms({
      from: '709-555-0100',
      to: '+17095550000',
      text: 'Charge 73 Casey $100',
      pingramId: 'evt-a',
    })
    await handleInboundSms({
      from: '709-555-0100',
      to: '+17095550000',
      text: 'Y',
      pingramId: 'evt-b',
    })
    await handleInboundSms({
      from: '709-555-0100',
      to: '+17095550000',
      text: 'Y',
      pingramId: 'evt-c',
    })
    expect(db.expenses).toHaveLength(1)
  })

  it('cancels on N without posting', async () => {
    const { handleInboundSms } = await import('./charge-capture')
    await handleInboundSms({
      from: '709-555-0100',
      to: '+17095550000',
      text: 'Charge 73 Casey $100',
      pingramId: 'evt-n1',
    })
    await handleInboundSms({
      from: '709-555-0100',
      to: '+17095550000',
      text: 'N',
      pingramId: 'evt-n2',
    })
    expect(db.expenses).toHaveLength(0)
    expect(db.drafts[0].status).toBe('cancelled')
    const last = String(sendChargeCaptureSms.mock.calls.at(-1)?.[0]?.message ?? '')
    expect(last).toMatch(/Cancelled/i)
  })
})
