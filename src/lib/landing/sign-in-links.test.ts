import { describe, expect, it } from 'vitest'
import { SIGN_IN_LINKS } from './content'

describe('SIGN_IN_LINKS', () => {
  it('exposes Admin portal as a direct /app entry', () => {
    expect(SIGN_IN_LINKS[0]).toMatchObject({
      label: 'Admin portal',
      href: '/app',
    })
  })
})
