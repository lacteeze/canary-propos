// src/app/(admin)/layout.tsx
// Admin portal route group
// INDEPENDENT server-side role check (Pitfall 6) — do not remove.
// Middleware is a first layer only; this layout performs its own getUser() call
// so that admin routes can never be reached by a non-admin even if middleware is bypassed.
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No session → back to login
  if (!user) {
    redirect('/login')
  }

  // Must be admin — independent from middleware (Pitfall 6: admin isolation)
  const role = user.app_metadata?.role as string | undefined
  if (role !== 'admin') {
    redirect('/login')
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF9' }}>
      {/* Admin shell — minimal nav for platform superuser */}
      <div className="flex min-h-screen">
        <aside
          className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0"
          style={{ backgroundColor: '#F5F4F2' }}
        >
          <div className="flex items-center gap-3 px-6 py-5 border-b border-stone-200">
            <div className="w-8 h-8 rounded bg-stone-300 flex items-center justify-center text-xs font-semibold text-stone-600">
              A
            </div>
            <span className="text-base font-semibold text-stone-900 truncate">
              Admin
            </span>
          </div>
          <nav className="flex-1 px-3 py-4">
            <a
              href="/admin"
              className="flex items-center gap-3 px-3 rounded-md min-h-11 text-sm text-stone-600 hover:bg-stone-200 hover:text-stone-900 transition-colors"
            >
              Platform Overview
            </a>
          </nav>
          <div className="px-4 py-4 border-t border-stone-200">
            <div className="flex items-center gap-3 min-h-11">
              <div className="w-8 h-8 rounded-full bg-stone-300 flex items-center justify-center text-xs font-semibold text-stone-600 shrink-0">
                A
              </div>
              <span className="text-sm text-stone-700 truncate">Admin</span>
            </div>
          </div>
        </aside>
        <div className="flex-1 lg:ml-60">
          <main className="p-4 lg:p-8 max-w-[1280px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
