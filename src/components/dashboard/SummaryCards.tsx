// src/components/dashboard/SummaryCards.tsx
// 4-card summary grid for manager dashboard — RSC-compatible (no 'use client')
import { Building2, Users, DoorOpen, FileText } from 'lucide-react'

interface SummaryCardsProps {
  totalUnits: number
  occupiedUnits: number
  vacantUnits: number
  activeLeases: number
}

interface CardDef {
  icon: React.ComponentType<{ className?: string }>
  value: number
  label: string
}

export function SummaryCards({
  totalUnits,
  occupiedUnits,
  vacantUnits,
  activeLeases,
}: SummaryCardsProps) {
  const cards: CardDef[] = [
    { icon: Building2, value: totalUnits, label: 'Total Units' },
    { icon: Users, value: occupiedUnits, label: 'Occupied' },
    { icon: DoorOpen, value: vacantUnits, label: 'Vacant' },
    { icon: FileText, value: activeLeases, label: 'Active Leases' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {cards.map(({ icon: Icon, value, label }) => (
        <div
          key={label}
          className="rounded-xl border border-stone-200 bg-white p-4"
        >
          <Icon className="mb-2 h-5 w-5 text-stone-400" />
          <p className="text-xl font-semibold text-stone-900">{value}</p>
          <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
        </div>
      ))}
    </div>
  )
}
