// src/app/(owner-nologin)/layout.tsx
// Minimal layout for owner no-login pages (approve/decline work orders).
// No app navigation, no session requirement.
import type { ReactNode } from 'react'

export default function OwnerNoLoginLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#FAFAF9' }}>
        {children}
      </body>
    </html>
  )
}
