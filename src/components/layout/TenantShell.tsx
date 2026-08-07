'use client'

// Tenant portal shell — Canary PortalShell
import type { ReactNode } from 'react'
import { Home, CreditCard, Wrench, Receipt } from 'lucide-react'
import PortalShell from './PortalShell'

const NAV_ITEMS = [
  { label: 'Home', href: '/my-home', icon: Home, exact: true },
  { label: 'Pay', href: '/my-home/pay', icon: CreditCard },
  { label: 'Payments', href: '/my-home/payments', icon: Receipt },
  { label: 'Maintenance', href: '/my-home/maintenance', icon: Wrench },
]

interface TenantShellProps {
  children: ReactNode
  orgName?: string
  tenantName?: string
}

export default function TenantShell({
  children,
  orgName = 'Canary',
  tenantName = 'Tenant',
}: TenantShellProps) {
  return (
    <PortalShell
      orgName={orgName}
      userName={tenantName}
      portalLabel="Tenant portal"
      homeHref="/my-home"
      navItems={NAV_ITEMS}
    >
      {children}
    </PortalShell>
  )
}
