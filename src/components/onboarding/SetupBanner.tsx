// src/components/onboarding/SetupBanner.tsx
// Persistent "Complete your setup" banner (D-02, UI-SPEC §2 Skipped steps)
// Shown on manager dashboard when organizations.setup_completed_at is null
'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, X } from 'lucide-react'

interface SetupBannerProps {
  setupComplete: boolean
}

const DISMISS_KEY = 'canary:setup-banner-dismissed'

export function SetupBanner({ setupComplete }: SetupBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(localStorage.getItem(DISMISS_KEY) === 'true')
    }
  }, [])

  // Don't render if setup is complete
  if (setupComplete) return null
  // Don't render if user dismissed it (persists in localStorage)
  if (dismissed) return null

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div
      role="alert"
      className="relative mb-6 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4"
      style={{ borderLeft: '4px solid #D97706' }}
    >
      <AlertCircle
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
        aria-hidden="true"
      />
      <div className="flex-1 text-sm text-amber-900">
        <span className="font-semibold">Complete your setup</span>
        {' — '}
        <a
          href="/settings"
          className="underline underline-offset-2 hover:text-amber-700"
        >
          Continue setup →
        </a>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss setup banner"
        title="Dismiss"
        className="flex-shrink-0 text-amber-600 hover:text-amber-800"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
