// src/app/(manager)/layout.tsx
// LEGACY SHELL — Do not build new features here.
// New manager UX belongs in CanaryApp (`src/app/(canary)/app`, `CanaryApp.tsx`).
// This route group remains only for leftover detail pages (property/lease/WO)
// until those are migrated into Canary drawers/views. List routes redirect to /app.
import type { ReactNode } from 'react'
import ManagerShell from '@/components/layout/ManagerShell'

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return <ManagerShell>{children}</ManagerShell>
}
