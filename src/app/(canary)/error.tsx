'use client'

import { CanaryChromeNotice } from '@/components/canary/EntityPageShell'

export default function CanaryError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CanaryChromeNotice title="Something went wrong">
      <p style={{ margin: '0 0 16px' }}>{error.message || 'This page failed to load.'}</p>
      <button
        type="button"
        onClick={reset}
        style={{
          minHeight: 44,
          padding: '10px 16px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--card, #fff)',
          color: 'var(--text)',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </CanaryChromeNotice>
  )
}
