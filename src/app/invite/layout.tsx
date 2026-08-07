// Invite accept — Canary fonts (page already uses cnry / cy-* styles)
import type { ReactNode } from 'react'
import CanaryFontShell from '@/components/layout/CanaryFontShell'
import '@/design-system/macos27/index.css'
import '@/components/canary/canary.css'

export default function InviteLayout({ children }: { children: ReactNode }) {
  return <CanaryFontShell>{children}</CanaryFontShell>
}
