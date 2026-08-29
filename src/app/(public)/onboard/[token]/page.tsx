import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { loadIntakeSubmission } from '@/app/actions/intake'
import { OnboardForm } from '@/components/intake/OnboardForm'
import { OnboardPageShell } from '@/components/intake/OnboardPageShell'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: 'Property intake | Canary',
  description: 'Continue your Canary property intake form.',
}

export default async function OnboardTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await loadIntakeSubmission(token)

  if (!result.success) {
    return (
      <OnboardPageShell eyebrow="Property intake" title="This link isn’t valid">
        <div className="cpub-form-card">
          <h2>We couldn’t open this form</h2>
          <p className="cpub-form-sub">{result.error}</p>
          <a href="/onboard" className="cpub-btn-primary">
            Start a new form
          </a>
        </div>
      </OnboardPageShell>
    )
  }

  if (result.submission.status !== 'draft') {
    redirect(`/onboard/${token}/complete`)
  }

  return (
    <OnboardPageShell
      eyebrow="Owners & new clients"
      title="Tell us about your property"
      description="Your answers save as you go. Keep this link — we’ll also email it after your contact details."
    >
      <OnboardForm initial={result.submission} />
    </OnboardPageShell>
  )
}
