import { describe, expect, it } from 'vitest'
import { filterSelectOptions } from './SearchableSelect'

describe('filterSelectOptions', () => {
  const people = [
    { value: '1', label: 'Ada Lovelace', searchText: 'ada lovelace ada@example.com' },
    { value: '2', label: 'Alan Turing', searchText: 'alan turing alan@example.com' },
    { value: '3', label: 'Grace Hopper', searchText: 'grace hopper grace@navy.mil' },
  ]

  it('returns all options when the query is empty', () => {
    expect(filterSelectOptions(people, '  ')).toEqual(people)
  })

  it('matches a name substring without scanning the full list by eye', () => {
    expect(filterSelectOptions(people, 'hopp').map((o) => o.value)).toEqual(['3'])
  })

  it('matches email and other searchText', () => {
    expect(filterSelectOptions(people, 'navy.mil').map((o) => o.label)).toEqual(['Grace Hopper'])
  })
})
