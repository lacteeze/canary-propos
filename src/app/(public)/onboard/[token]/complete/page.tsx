import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { loadIntakeSubmission } from '@/app/actions/intake'
import { OnboardPageShell } from '@/components/intake/OnboardPageShell'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: 'Intake received | Canary',
  description: 'We received your property details.',
}

export default async function OnboardCompletePage({
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
          <h2>We couldn’t find this submission</h2>
          <p className="cpub-form-sub">{result.error}</p>
          <a href="/onboard" className="cpub-btn-primary">
            Start a new form
          </a>
        </div>
      </OnboardPageShell>
    )
  }

  if (result.submission.status === 'draft') {
    redirect(`/onboard/${token}`)
  }

  const name = result.submission.contact_name
  const address = result.submission.property_address

  return (
    <OnboardPageShell
      eyebrow="You’re all set"
      title="We received your property details"
      description="No further action is needed from you right now. The Canary team will follow up about next steps."
    >
      <div className="cpub-form-card cint-complete">
        <div className="cint-complete-mark" aria-hidden>
          ✓
        </div>
        <h2>Thanks{name ? `, ${name}` : ''}</h2>
        <p className="cpub-form-sub" style={{ marginBottom: 0 }}>
          {address
            ? `Submitted for ${address}.`
            : 'Your intake is in. We’ll be in touch if we need anything else.'}
        </p>
      </div>
    </OnboardPageShell>
  )
}
