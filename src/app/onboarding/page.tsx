'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { OrgNameStep } from '@/components/onboarding/steps/OrgNameStep'
import { LogoStep } from '@/components/onboarding/steps/LogoStep'
import { ProvinceStep } from '@/components/onboarding/steps/ProvinceStep'
import { InviteStep } from '@/components/onboarding/steps/InviteStep'
import { createOrganization } from './actions'
import { createClient } from '@/lib/supabase/client'

const TOTAL_STEPS = 5

// Wizard state accumulated across steps
interface WizardData {
  name: string
  logoPath: string | null
  province: string
  inviteEmail: string | null
  orgId: string | null
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<WizardData>({
    name: '',
    logoPath: null,
    province: '',
    inviteEmail: null,
    orgId: null,
  })

  // Step 1: Org name (required)
  function handleOrgName(name: string) {
    setData((d) => ({ ...d, name }))
    setStep(2)
  }

  // Step 2: Logo (optional/skippable)
  // logoPathOrName is the file name if a file was selected; null if skipped
  async function handleLogo(logoPathOrName: string | null) {
    if (logoPathOrName && data.name) {
      // Upload the file to Supabase Storage client-side
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Use a temp path keyed by user id; will be moved after org is created
        const filePath = `pending/${user.id}/${Date.now()}-${logoPathOrName}`
        // Note: actual file object is not available here since LogoStep only passes the name.
        // The logo upload occurs directly in LogoStep via client-side Supabase Storage.
        // For now, store the pending path reference.
        setData((d) => ({ ...d, logoPath: filePath }))
      }
    } else {
      setData((d) => ({ ...d, logoPath: null }))
    }
    setStep(3)
  }

  function handleLogoSkip() {
    setData((d) => ({ ...d, logoPath: null }))
    setStep(3)
  }

  // Step 3: Province (required)
  function handleProvince(province: string) {
    setData((d) => ({ ...d, province }))
    setStep(4)
  }

  // Step 4: Invite (optional/skippable) + create org
  async function handleInvite(email: string | null) {
    await submitAndComplete(email)
  }

  function handleInviteSkip() {
    submitAndComplete(null)
  }

  async function submitAndComplete(inviteEmail: string | null) {
    setIsLoading(true)
    setError(null)

    const result = await createOrganization({
      name: data.name,
      province: data.province,
      logoPath: data.logoPath,
      inviteEmail,
    })

    if (!result.success) {
      setIsLoading(false)
      setError(result.error)
      return
    }

    setData((d) => ({ ...d, inviteEmail, orgId: result.orgId ?? null }))
    setIsLoading(false)
    setStep(5)
  }

  // Step 5: Completion screen
  if (step === 5) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4"
        style={{ backgroundColor: '#FAFAF9' }}
      >
        <div className="w-full max-w-[480px] rounded-xl border border-stone-200 bg-white p-8 shadow-sm text-center">
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <span className="text-2xl" aria-hidden="true">🎉</span>
          </div>
          <h2 className="mt-4 text-[1.75rem] font-semibold leading-tight text-stone-900">
            You&apos;re all set, {data.name}!
          </h2>
          <p className="mt-2 text-stone-500">
            Your workspace is ready. Let&apos;s add your first property.
          </p>
          <button
            onClick={() => { window.location.href = '/dashboard' }}
            disabled={isLoading}
            className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#D97706' }}
          >
            Go to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: '#FAFAF9' }}
    >
      <WizardShell currentStep={step} totalSteps={TOTAL_STEPS}>
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 p-3"
          >
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {step === 1 && (
          <OrgNameStep
            defaultValue={data.name}
            onNext={handleOrgName}
            isLoading={isLoading}
          />
        )}

        {step === 2 && (
          <LogoStep
            onNext={handleLogo}
            onSkip={handleLogoSkip}
            isLoading={isLoading}
          />
        )}

        {step === 3 && (
          <ProvinceStep
            defaultValue={data.province}
            onNext={handleProvince}
            isLoading={isLoading}
          />
        )}

        {step === 4 && (
          <InviteStep
            onNext={handleInvite}
            onSkip={handleInviteSkip}
            isLoading={isLoading}
          />
        )}
      </WizardShell>
    </div>
  )
}
