'use client'

import { Progress } from '@/components/ui/progress'

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
  const progressPercent = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100)

  return (
    <div className="w-full max-w-[480px]">
      {/* Step counter */}
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[0.875rem] text-stone-500" aria-label={`Step ${currentStep} of ${totalSteps}: ${STEP_LABELS[currentStep - 1]}`}>
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-[0.875rem] text-stone-500">
          {STEP_LABELS[currentStep - 1]}
        </span>
      </div>

      {/* Progress bar */}
      <Progress
        value={progressPercent}
        className="mb-6 h-1.5"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      />

      {/* Step content */}
      <div className="rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </div>
  )
}
