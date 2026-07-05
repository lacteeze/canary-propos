// src/app/(auth)/layout.tsx
// Unauthenticated layout — centered card, no nav
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#FAFAF9' }}
    >
      {children}
    </div>
  )
}
