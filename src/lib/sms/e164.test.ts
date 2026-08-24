import { describe, it, expect } from 'vitest'
import { phonesEqual, toE164 } from './e164'

describe('toE164', () => {
  it('normalizes a local 709 number', () => {
    expect(toE164('709-555-0100')).toBe('+17095550100')
  })

  it('leaves E.164 unchanged', () => {
    expect(toE164('+17095550100')).toBe('+17095550100')
  })
})

describe('phonesEqual', () => {
  it('ignores formatting', () => {
    expect(phonesEqual('(709) 555-0100', '+1 709 555 0100')).toBe(true)
    expect(phonesEqual('7095550100', '+17095550100')).toBe(true)
    expect(phonesEqual('709-555-0100', '709-555-0199')).toBe(false)
  })
})
