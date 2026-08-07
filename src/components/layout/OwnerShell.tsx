'use client'

// Owner portal shell — Canary PortalShell
import type { ReactNode } from 'react'
import { Building2, FileText, Wrench } from 'lucide-react'
import PortalShell from './PortalShell'

const NAV_ITEMS = [
  { label: 'Portfolio', href: '/portfolio', icon: Building2 },
  { label: 'Statements', href: '/statements', icon: FileText },
  { label: 'Maintenance', href: '/owner-maintenance', icon: Wrench },
]

interface OwnerShellProps {
  children: ReactNode
  orgName?: string
  ownerName?: string
}

export default function OwnerShell({
  children,
  orgName = 'Canary',
  ownerName = 'Owner',
}: OwnerShellProps) {
  return (
    <PortalShell
      orgName={orgName}
      userName={ownerName}
      portalLabel="Owner portal"
      homeHref="/portfolio"
      navItems={NAV_ITEMS}
    >
      {children}
    </PortalShell>
  )
}
