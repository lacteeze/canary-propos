import type { ReactNode } from 'react'
import { PublicHeader } from '@/components/public/PublicHeader'
import { fontDisplay } from '@/lib/landing/typography'

export function OnboardPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <>
      <PublicHeader />
      <main className="cint-page">
        <header className="cint-hero">
          <p className="cint-eyebrow">{eyebrow}</p>
          <h1 className="cint-title" style={{ fontFamily: fontDisplay }}>
            {title}
          </h1>
          {description ? <p className="cint-lede">{description}</p> : null}
        </header>
        {children}
      </main>
    </>
  )
}
