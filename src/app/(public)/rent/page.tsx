// Public shareable “Tell us what you're looking for” form — canarypm.ca/rent
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { InterestForm } from '@/components/listings/InterestForm'
import { PublicHeader } from '@/components/public/PublicHeader'
import { fontDisplay } from '@/lib/landing/typography'
import { getOrgBySlug } from '@/lib/orgs'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: "Tell us what you're looking for | Canary",
  description:
    "Share your must-haves and get on Canary Property Management's list for upcoming rentals in St. John's and surrounding areas.",
  openGraph: {
    title: "Tell us what you're looking for | Canary",
    description:
      "Get on our list — share your must-haves and we'll match you with upcoming homes.",
  },
}

export default async function RentInterestPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>
}) {
  const { org: orgSlugParam } = await searchParams
  const headersList = await headers()
  const orgSlug =
    headersList.get('x-org-slug') ||
    orgSlugParam ||
    process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ||
    'canary'
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  return (
    <>
      <PublicHeader />
      <main
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '96px clamp(20px, 4vw, 32px) 64px',
        }}
      >
        <header style={{ marginBottom: 28, textAlign: 'center' }}>
          <p
            style={{
              margin: '0 0 10px',
              fontFamily: 'var(--font-ibm-plex-mono), monospace',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--faint)',
              fontWeight: 600,
            }}
          >
            Looking for a home?
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: fontDisplay,
              fontWeight: 600,
              fontSize: 'clamp(28px, 5vw, 36px)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              color: 'var(--text)',
            }}
          >
            Tell us what you&apos;re looking for
          </h1>
          <p
            style={{
              margin: '12px auto 0',
              maxWidth: 420,
              fontSize: 15,
              lineHeight: 1.55,
              color: 'var(--dim)',
            }}
          >
            Get on our list — share your must-haves and we&apos;ll reach out when something
            matches.
          </p>
        </header>

        <div className="cpub-forms-stack">
          <InterestForm
            orgId={org.id}
            propertyLabel="Shareable interest form (/rent)"
            hideHeading
          />
        </div>
      </main>
    </>
  )
}
