// src/app/(manager)/layout.tsx
// Manager portal route group — wraps all manager/employee pages
import type { ReactNode } from 'react'
import ManagerShell from '@/components/layout/ManagerShell'

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return <ManagerShell>{children}</ManagerShell>
}
