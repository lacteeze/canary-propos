import { describe, it, expect } from 'vitest'
import { parseChargeNote } from './parse-charge-note'

describe('parseChargeNote', () => {
  it('extracts supplies, hours, and address from a long note', () => {
    const parsed = parseChargeNote(
      '$48.62 in supplies billed to 73 Casey Street plus 2 hours of time'
    )
    expect(parsed.kind).toBe('charge')
    expect(parsed.suppliesCost).toBe(48.62)
    expect(parsed.labourHours).toBe(2)
    expect(parsed.addressHint.toLowerCase()).toContain('73 casey')
  })

  it('treats a bare $100 as two hours of labour (D-09)', () => {
    const parsed = parseChargeNote('Charge 73 Casey $100')
    expect(parsed.kind).toBe('charge')
    expect(parsed.suppliesCost).toBe(0)
    expect(parsed.labourHours).toBe(2)
    expect(parsed.addressHint.toLowerCase()).toContain('73 casey')
  })

  it('classifies Y/N as confirm/cancel, not a new charge', () => {
    expect(parseChargeNote('Y').kind).toBe('confirm')
    expect(parseChargeNote('n').kind).toBe('cancel')
  })

  it('classifies Reply 1-5 as propertyChoice', () => {
    expect(parseChargeNote('1').kind).toBe('propertyChoice')
    expect(parseChargeNote('1').propertyChoice).toBe(1)
  })

  it('ignores STOP/HELP/START', () => {
    expect(parseChargeNote('STOP').kind).toBe('ignore')
    expect(parseChargeNote('HELP').kind).toBe('ignore')
  })

  it('fills hours/supplies from a learned phrase when the note has no amounts', () => {
    const parsed = parseChargeNote('Airbnb Restock 73 Casey', {
      phrases: [
        {
          normalized_phrase: 'airbnb restock',
          typical_hours: 1,
          typical_supplies_cost: 40,
          category: 'Supplies',
        },
      ],
    })
    expect(parsed.kind).toBe('charge')
    expect(parsed.labourHours).toBe(1)
    expect(parsed.suppliesCost).toBe(40)
    expect(parsed.category).toBe('Supplies')
  })
})
