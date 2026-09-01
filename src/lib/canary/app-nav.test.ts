import { describe, expect, it } from 'vitest'
import {
  beginAppNav,
  endAppNav,
  subscribeAppNav,
  viewNeedsHospitable,
  viewNeedsOrgTasks,
} from './app-nav'

describe('viewNeedsHospitable', () => {
  it('loads STR data only on screens that show the calendar or tasks', () => {
    expect(viewNeedsHospitable(undefined)).toBe(true)
    expect(viewNeedsHospitable('leases')).toBe(true)
    expect(viewNeedsHospitable('people')).toBe(false)
    expect(viewNeedsHospitable('properties')).toBe(false)
  })
})

describe('viewNeedsOrgTasks', () => {
  it('skips team-task fetch on people and property lists', () => {
    expect(viewNeedsOrgTasks('tasks')).toBe(true)
    expect(viewNeedsOrgTasks('payments')).toBe(false)
  })
})

describe('app nav pending signal', () => {
  it('notifies subscribers when a screen change starts and finishes', () => {
    const seen: boolean[] = []
    const stop = subscribeAppNav((pending) => seen.push(pending))
    beginAppNav()
    endAppNav()
    stop()
    beginAppNav()
    expect(seen).toEqual([true, false])
  })
})
