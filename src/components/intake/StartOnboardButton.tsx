'use client'

import { useFormStatus } from 'react-dom'

export function StartOnboardButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="cpub-btn-primary" disabled={pending}>
      {pending ? 'Starting…' : 'Get started'}
    </button>
  )
}
