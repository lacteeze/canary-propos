// src/app/(public)/layout.tsx
// Minimal layout for the (public) route group — no auth, no sidebar.
// Used for public-facing listing pages accessible without signing in.
import type { ReactNode } from 'react'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <span className="text-lg font-semibold text-stone-800 tracking-tight">
            Rentals
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
