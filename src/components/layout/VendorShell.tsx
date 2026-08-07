'use client'

// Vendor portal shell — Canary PortalShell
import type { ReactNode } from 'react'
import { Briefcase } from 'lucide-react'
import PortalShell from './PortalShell'

const NAV_ITEMS = [{ label: 'My Jobs', href: '/jobs', icon: Briefcase }]

interface VendorShellProps {
  children: ReactNode
  orgName?: string
  vendorName?: string
}

export default function VendorShell({
  children,
  orgName = 'Canary',
  vendorName = 'Vendor',
}: VendorShellProps) {
  return (
    <PortalShell
      orgName={orgName}
      userName={vendorName}
      portalLabel="Vendor portal"
      homeHref="/jobs"
      navItems={NAV_ITEMS}
    >
      {children}
    </PortalShell>
  )
}
