import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { startIntakeFormAction } from '@/app/actions/intake'
import { OnboardPageShell } from '@/components/intake/OnboardPageShell'
import { StartOnboardButton } from '@/components/intake/StartOnboardButton'
import { resolveOnboardOrg } from '@/lib/intake/resolve-org'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: 'Property intake | Canary',
  description:
    'Share your property details with Canary Property Management — contact, units, utilities, and photos in one form.',
  openGraph: {
    title: 'Property intake | Canary',
    description: 'Tell us about your property. We’ll email you a private link so you can finish later.',
  },
}

export default async function OnboardStartPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; error?: string }>
}) {
  const { org: orgSlugParam, error } = await searchParams
  const org = await resolveOnboardOrg(orgSlugParam)
  if (!org) notFound()

  return (
    <OnboardPageShell
      eyebrow="Owners & new clients"
      title="Tell us about your property"
      description="Seven short steps on your phone. We’ll email a private link so you can pick up where you left off."
    >
      <div className="cpub-forms-stack">
        <div className="cpub-form-card">
          <h2>Ready when you are</h2>
          <p className="cpub-form-sub">
            This is for owners bringing a property to {org.name}. Looking for a rental? Use{' '}
            <a href="/rent" className="cint-inline-link">
              /rent
            </a>{' '}
            instead.
          </p>
          {error ? <p className="cint-error">{error}</p> : null}
          <form action={startIntakeFormAction}>
            <input type="hidden" name="org" value={org.slug} />
            <div className="cint-nav cint-nav--end">
              <StartOnboardButton />
            </div>
          </form>
        </div>
      </div>
    </OnboardPageShell>
  )
}
