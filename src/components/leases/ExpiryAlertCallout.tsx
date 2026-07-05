// src/components/leases/ExpiryAlertCallout.tsx
// Lease expiry alert section — groups expiring leases into urgency buckets (LEASE-03)

export interface ExpiringLease {
  id: string
  tenantName: string
  propertyUnit: string
  endDate: string
  daysUntilExpiry: number
}

interface ExpiryAlertCalloutProps {
  leases: ExpiringLease[]
}

interface BucketConfig {
  label: string
  bg: string
  border: string
  text: string
  badgeBg: string
  badgeText: string
}

const BUCKETS: Record<string, BucketConfig> = {
  urgent: {
    label: 'Expiring within 30 days',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
  },
  warning: {
    label: 'Expiring in 31–60 days',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  notice: {
    label: 'Expiring in 61–90 days',
    bg: 'bg-stone-50',
    border: 'border-stone-200',
    text: 'text-stone-600',
    badgeBg: 'bg-stone-100',
    badgeText: 'text-stone-600',
  },
}

export function ExpiryAlertCallout({ leases = [] }: ExpiryAlertCalloutProps) {
  const urgent = leases.filter((l) => l.daysUntilExpiry <= 30)
  const warning = leases.filter((l) => l.daysUntilExpiry > 30 && l.daysUntilExpiry <= 60)
  const notice = leases.filter((l) => l.daysUntilExpiry > 60 && l.daysUntilExpiry <= 90)

  const groups: Array<{ key: string; leases: ExpiringLease[] }> = [
    { key: 'urgent', leases: urgent },
    { key: 'warning', leases: warning },
    { key: 'notice', leases: notice },
  ]

  const nonEmpty = groups.filter((g) => g.leases.length > 0)
  if (nonEmpty.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        Lease Expiry Alerts
      </h2>
      {nonEmpty.map(({ key, leases: groupLeases }) => {
        const cfg = BUCKETS[key]
        return (
          <div
            key={key}
            className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}
          >
            <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${cfg.text}`}>
              {cfg.label}
            </p>
            <ul className="space-y-2">
              {groupLeases.map((lease) => (
                <li key={lease.id} className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-stone-900">{lease.tenantName}</span>
                  <span className="text-xs text-stone-500">{lease.propertyUnit}</span>
                  <span
                    className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badgeBg} ${cfg.badgeText}`}
                  >
                    {lease.daysUntilExpiry}d left
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
