'use client'

import { useState } from 'react'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { SignOutButton } from '@/components/onboarding/SignOutButton'
import { OrgNameStep } from '@/components/onboarding/steps/OrgNameStep'
import { LogoStep } from '@/components/onboarding/steps/LogoStep'
import { ProvinceStep } from '@/components/onboarding/steps/ProvinceStep'
import { InviteStep } from '@/components/onboarding/steps/InviteStep'
import { createOrganization } from '@/app/onboarding/actions'
import { createClient } from '@/lib/supabase/client'

const TOTAL_STEPS = 5

interface WizardData {
  name: string
  logoPath: string | null
  province: string
  inviteEmail: string | null
  orgId: string | null
}

async function refreshSessionClaims() {
  const supabase = createClient()
  await supabase.auth.refreshSession()
}

export function OnboardingWizard() {
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [goingToApp, setGoingToApp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<WizardData>({
    name: '',
    logoPath: null,
    province: '',
    inviteEmail: null,
    orgId: null,
  })

  function handleOrgName(name: string) {
    setData((d) => ({ ...d, name }))
    setStep(2)
  }

  async function handleLogo(logoPathOrName: string | null) {
    if (logoPathOrName && data.name) {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const filePath = `pending/${user.id}/${Date.now()}-${logoPathOrName}`
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

  function handleProvince(province: string) {
    setData((d) => ({ ...d, province }))
    setStep(4)
  }

  async function handleInvite(email: string | null) {
    await submitAndComplete(email)
  }

  function handleInviteSkip() {
    void submitAndComplete(null)
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

    // Ensure browser JWT carries org_id/role before navigating to /app
    await refreshSessionClaims()

    setData((d) => ({ ...d, inviteEmail, orgId: result.orgId ?? null }))
    setIsLoading(false)
    setStep(5)
  }

  async function goToDashboard() {
    setGoingToApp(true)
    setError(null)
    try {
      await refreshSessionClaims()
      window.location.href = '/app'
    } catch {
      setGoingToApp(false)
      setError('Could not open the dashboard. Try Sign out, then sign back in.')
    }
  }

  if (step === 5) {
    return (
      <div className="onboard-wrap">
        <div className="onboard-top">
          <span className="onboard-step-meta">Complete</span>
          <SignOutButton />
        </div>
        <div className="onboard-card" style={{ textAlign: 'center' }}>
          <div className="onboard-complete-icon" aria-hidden="true">
            ✓
          </div>
          <h2 className="onboard-title">You&apos;re all set, {data.name}!</h2>
          <p className="onboard-sub" style={{ marginBottom: 22 }}>
            Your workspace is ready. Let&apos;s add your first property.
          </p>
          {error && (
            <div role="alert" className="auth-alert auth-alert-error" style={{ marginBottom: 14, textAlign: 'left' }}>
              <p>{error}</p>
            </div>
          )}
          <div className="onboard-actions">
            <button
              type="button"
              onClick={() => void goToDashboard()}
              disabled={goingToApp}
              className="auth-btn"
            >
              {goingToApp ? 'Opening dashboard…' : 'Go to dashboard'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <WizardShell currentStep={step} totalSteps={TOTAL_STEPS}>
      {error && (
        <div role="alert" className="auth-alert auth-alert-error" style={{ marginBottom: 14 }}>
          <p>{error}</p>
        </div>
      )}

      {step === 1 && (
        <OrgNameStep defaultValue={data.name} onNext={handleOrgName} isLoading={isLoading} />
      )}

      {step === 2 && (
        <LogoStep onNext={handleLogo} onSkip={handleLogoSkip} isLoading={isLoading} />
      )}

      {step === 3 && (
        <ProvinceStep
          defaultValue={data.province}
          onNext={handleProvince}
          isLoading={isLoading}
        />
      )}

      {step === 4 && (
        <InviteStep onNext={handleInvite} onSkip={handleInviteSkip} isLoading={isLoading} />
      )}
    </WizardShell>
  )
}
