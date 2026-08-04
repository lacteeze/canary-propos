'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Escape hatch — always visible during onboarding so users aren't trapped. */
export function SignOutButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={busy}
      className={className ?? 'cy-btn-ghost'}
      style={{ fontSize: 13 }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
