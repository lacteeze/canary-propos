// src/app/(auth)/layout.tsx
// Unauthenticated layout — follows landing-page light/dark preference
import type { ReactNode } from 'react'
import { IBM_Plex_Mono, Instrument_Sans } from 'next/font/google'
import { AuthThemeShell } from '@/components/auth/AuthThemeShell'
import '@/design-system/macos27/index.css'
import '@/components/canary/canary.css'
import './auth.css'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
})

export const metadata = {
  title: 'Sign in — Canary PM',
  description: 'Canary property management',
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthThemeShell className={`${instrumentSans.className} ${plexMono.variable}`}>
      {children}
    </AuthThemeShell>
  )
}
