// src/app/(public)/layout.tsx
// Minimal layout for the (public) route group — no auth, no sidebar.
// Used for public-facing listing pages accessible without signing in.
import type { ReactNode } from 'react'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f3efe7]">
      <header className="sticky top-0 z-40 border-b border-[#e4dcce] bg-[#fbf9f4]">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-5 py-3.5">
          <span className="text-[17px] font-bold tracking-tight text-[#2b251d]">
            Canary
          </span>
          <span className="text-[13.5px] font-semibold text-[#7d7263]">Listings</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-5 py-8">{children}</main>
    </div>
  )
}
