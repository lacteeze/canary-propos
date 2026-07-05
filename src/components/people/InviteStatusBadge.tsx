// src/components/people/InviteStatusBadge.tsx
// Invite status badge — "Active" (emerald) or "Invite sent" (amber) (D-09, UI-SPEC §4)
// Color is NEVER the sole indicator — always includes icon + text (Accessibility contract)
import { CheckCircle2, Clock } from 'lucide-react'

interface InviteStatusBadgeProps {
  inviteAcceptedAt: string | null
}

export function InviteStatusBadge({ inviteAcceptedAt }: InviteStatusBadgeProps) {
  const isActive = !!inviteAcceptedAt

  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Active
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      Invite sent
    </span>
  )
}
