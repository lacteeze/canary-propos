'use client'

import { SignOutButton } from '@/components/onboarding/SignOutButton'

interface WizardShellProps {
  currentStep: number
  totalSteps: number
  children: React.ReactNode
}

const STEP_LABELS = [
  'Organization name',
  'Logo',
  'Province',
  'Invite team member',
  'Complete',
]

export function WizardShell({ currentStep, totalSteps, children }: WizardShellProps) {
  const progressPercent = Math.round(((currentStep - 1) / Math.max(totalSteps - 1, 1)) * 100)
  const label = STEP_LABELS[currentStep - 1] ?? `Step ${currentStep}`

  return (
    <div className="onboard-wrap">
      <div className="onboard-top">
        <span
          className="onboard-step-meta"
          aria-label={`Step ${currentStep} of ${totalSteps}: ${label}`}
        >
          Step {currentStep} of {totalSteps} · {label}
        </span>
        <SignOutButton />
      </div>

      <div
        className="onboard-progress"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="onboard-card">{children}</div>
    </div>
  )
}
