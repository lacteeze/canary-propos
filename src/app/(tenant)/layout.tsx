// src/app/(tenant)/layout.tsx
// Tenant portal route group
import type { ReactNode } from 'react'
import TenantShell from '@/components/layout/TenantShell'

export default function TenantLayout({ children }: { children: ReactNode }) {
  return <TenantShell>{children}</TenantShell>
}
