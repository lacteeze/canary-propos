// src/app/(auth)/layout.tsx
// Unauthenticated layout — warm dark Canary shell, brand logo above a centered card
import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { IBM_Plex_Mono, Instrument_Sans } from 'next/font/google'
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
    <div className={`cnry ${instrumentSans.className} ${plexMono.variable}`}>
      <div className="auth-shell">
        <Link href="/" className="auth-brand" title="Canary Property Management — home">
          <Image
            src="/landing/logo-white.png"
            alt="Canary Property Management logo"
            width={36}
            height={36}
            style={{ objectFit: 'contain' }}
          />
          <span className="auth-brand-name">
            Canary <span>PM</span>
          </span>
        </Link>
        {children}
      </div>
    </div>
  )
}
