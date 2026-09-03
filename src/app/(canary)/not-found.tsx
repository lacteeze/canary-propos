import Link from 'next/link'
import { CanaryChromeNotice } from '@/components/canary/EntityPageShell'

export default function CanaryNotFound() {
  return (
    <CanaryChromeNotice title="Page not found">
      <p style={{ margin: '0 0 16px' }}>This page isn’t in the app.</p>
      <Link
        href="/app"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: 44,
          padding: '10px 16px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--card, #fff)',
          color: 'var(--text)',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Back to the app
      </Link>
    </CanaryChromeNotice>
  )
}
