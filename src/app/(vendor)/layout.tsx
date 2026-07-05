// src/app/(vendor)/layout.tsx
// Vendor portal route group
import type { ReactNode } from 'react'
import VendorShell from '@/components/layout/VendorShell'

export default function VendorLayout({ children }: { children: ReactNode }) {
  return <VendorShell>{children}</VendorShell>
}
