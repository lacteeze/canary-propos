const CHARGE_CATEGORIES = ['Maintenance', 'Supplies', 'Cleaning', 'Utilities', 'Other'] as const
const DEFAULT_LABOUR_RATE = 50

export type ParseKind = 'confirm' | 'cancel' | 'propertyChoice' | 'ignore' | 'charge'

export type LearnedPhrase = {
  normalized_phrase: string
  typical_hours: number | null
  typical_supplies_cost: number | null
  category: string | null
}

export type ParsedChargeNote = {
  kind: ParseKind
  propertyChoice?: number
  suppliesCost: number
  labourHours: number
  addressHint: string
  category: string
  note: string
  explicitSupplies: boolean
  explicitHours: boolean
}

export type ParseChargeNoteOptions = {
  phrases?: LearnedPhrase[]
  labourRate?: number
}

function detectCategory(text: string): string {
  for (const cat of CHARGE_CATEGORIES) {
    if (new RegExp(`\\b${cat}\\b`, 'i').test(text)) return cat
  }
  return 'Maintenance'
}

/**
 * Heuristic parser for staff charge SMS. Never posts — caller drafts and waits for Y.
 */
export function parseChargeNote(text: string, opts: ParseChargeNoteOptions = {}): ParsedChargeNote {
  const trimmed = (text || '').trim()
  const empty: ParsedChargeNote = {
    kind: 'charge',
    suppliesCost: 0,
    labourHours: 0,
    addressHint: '',
    category: 'Maintenance',
    note: trimmed,
    explicitSupplies: false,
    explicitHours: false,
  }
  if (!trimmed) return { ...empty, kind: 'ignore' }

  if (/^(stop|help|start)$/i.test(trimmed)) return { ...empty, kind: 'ignore' }
  if (/^(y|yes)$/i.test(trimmed)) return { ...empty, kind: 'confirm' }
  if (/^(n|no|cancel)$/i.test(trimmed)) return { ...empty, kind: 'cancel' }
  if (/^[1-5]$/.test(trimmed)) {
    return { ...empty, kind: 'propertyChoice', propertyChoice: Number(trimmed) }
  }

  let working = trimmed
  let suppliesCost = 0
  let labourHours = 0
  let explicitSupplies = false
  let explicitHours = false

  const suppliesRe =
    /(?:\$?([0-9]+(?:\.[0-9]{1,2})?)\s*(?:in\s+)?(?:supplies|parts|receipts?)|(?:supplies|parts|receipt)\s*\$?\s*([0-9]+(?:\.[0-9]{1,2})?))/gi
  working = working.replace(suppliesRe, (_m, a, b) => {
    const n = Number(a || b)
    if (!Number.isNaN(n)) {
      suppliesCost = n
      explicitSupplies = true
    }
    return ' '
  })

  const hoursRe = /([0-9]+(?:\.[0-9]+)?)\s*(?:hours?|hrs?)/gi
  working = working.replace(hoursRe, (_m, n) => {
    labourHours = Number(n)
    explicitHours = true
    return ' '
  })

  const labourRate = opts.labourRate ?? DEFAULT_LABOUR_RATE
  if (!explicitHours) {
    const bare = working.match(/\$([0-9]+(?:\.[0-9]{1,2})?)/)
    if (bare) {
      const amount = Number(bare[1])
      if (!Number.isNaN(amount) && labourRate > 0) {
        labourHours = amount / labourRate
        explicitHours = true
      }
      working = working.replace(bare[0], ' ')
    }
  } else {
    working = working.replace(/\$[0-9]+(?:\.[0-9]{1,2})?/g, ' ')
  }

  working = working.replace(/\b(charge|bill|billed|plus|of|time|to|in)\b/gi, ' ')
  const addressHint = working.replace(/[^a-zA-Z0-9.\s]/g, ' ').replace(/\s+/g, ' ').trim()

  let category = detectCategory(trimmed)
  let note = addressHint

  if (!explicitSupplies && !explicitHours && opts.phrases?.length) {
    const lower = trimmed.toLowerCase()
    const hit = [...opts.phrases]
      .filter((p) => p.normalized_phrase && lower.includes(p.normalized_phrase))
      .sort((a, b) => b.normalized_phrase.length - a.normalized_phrase.length)[0]
    if (hit) {
      if (hit.typical_supplies_cost != null) suppliesCost = Number(hit.typical_supplies_cost)
      if (hit.typical_hours != null) labourHours = Number(hit.typical_hours)
      if (hit.category) category = hit.category
    }
  }

  return {
    kind: 'charge',
    suppliesCost,
    labourHours,
    addressHint,
    category,
    note,
    explicitSupplies,
    explicitHours,
  }
}
