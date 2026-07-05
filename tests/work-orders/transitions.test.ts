import { describe, it, expect } from 'vitest'
import { TRANSITIONS, validateTransition } from '@/lib/work-orders/transitions'
import type { WorkOrderStatus } from '@/lib/work-orders/transitions'

describe('TRANSITIONS map', () => {
  it('has exactly 8 entries', () => {
    expect(Object.keys(TRANSITIONS)).toHaveLength(8)
  })

  it('TRANSITIONS["assigned"].allowedFrom includes submitted and approved', () => {
    expect(TRANSITIONS['assigned'].allowedFrom).toContain('submitted')
    expect(TRANSITIONS['assigned'].allowedFrom).toContain('approved')
  })

  it('TRANSITIONS["pending_approval"].allowedFrom includes only submitted', () => {
    expect(TRANSITIONS['pending_approval'].allowedFrom).toEqual(['submitted'])
  })

  it('TRANSITIONS["in_progress"].allowedFrom includes only assigned', () => {
    expect(TRANSITIONS['in_progress'].allowedFrom).toEqual(['assigned'])
  })

  it('TRANSITIONS["completed"].allowedFrom includes only in_progress', () => {
    expect(TRANSITIONS['completed'].allowedFrom).toEqual(['in_progress'])
  })

  it('TRANSITIONS["closed"].allowedFrom includes completed and pending_approval', () => {
    expect(TRANSITIONS['closed'].allowedFrom).toContain('completed')
    expect(TRANSITIONS['closed'].allowedFrom).toContain('pending_approval')
  })
})

describe('validateTransition', () => {
  it('submitted → assigned with manager role returns valid: true', () => {
    const result = validateTransition('submitted', 'assigned', ['manager'])
    expect(result).toEqual({ valid: true })
  })

  it('draft → completed with manager role returns valid: false with error', () => {
    const result = validateTransition('draft', 'completed', ['manager'])
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toMatch(/Cannot transition/i)
    }
  })

  it('submitted → assigned with tenant role returns valid: false with not permitted error', () => {
    const result = validateTransition('submitted', 'assigned', ['tenant'])
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toMatch(/not permitted/i)
    }
  })

  it('assigned → in_progress with vendor_token role returns valid: true', () => {
    const result = validateTransition('assigned', 'in_progress', ['vendor_token'])
    expect(result).toEqual({ valid: true })
  })

  it('draft → submitted with tenant role returns valid: true', () => {
    const result = validateTransition('draft', 'submitted', ['tenant'])
    expect(result).toEqual({ valid: true })
  })

  it('in_progress → completed with vendor_token returns valid: true', () => {
    const result = validateTransition('in_progress', 'completed', ['vendor_token'])
    expect(result).toEqual({ valid: true })
  })

  it('completed → closed with manager returns valid: true', () => {
    const result = validateTransition('completed', 'closed', ['manager'])
    expect(result).toEqual({ valid: true })
  })

  it('pending_approval → approved with manager returns valid: true', () => {
    const result = validateTransition('pending_approval', 'approved', ['manager'])
    expect(result).toEqual({ valid: true })
  })

  it('approved → assigned with manager returns valid: true', () => {
    const result = validateTransition('approved', 'assigned', ['manager'])
    expect(result).toEqual({ valid: true })
  })

  it('submitted → in_progress (skip) returns valid: false', () => {
    const result = validateTransition('submitted', 'in_progress', ['manager'])
    expect(result.valid).toBe(false)
  })
})
