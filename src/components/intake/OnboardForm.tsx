'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { saveIntakeStep, submitIntake, uploadIntakePhotos } from '@/app/actions/intake'
import { INTAKE_STEP_COUNT, STEP_TITLES, type IntakeSubmission } from '@/lib/intake/schema'
import { ContactStepForm } from './steps/ContactStep'
import { PropertyStepForm } from './steps/PropertyStep'
import { PropertyDetailsStepForm } from './steps/PropertyDetailsStep'
import { UnitsStepForm } from './steps/UnitsStep'
import { UtilitiesStepForm } from './steps/UtilitiesStep'
import { ResponsibilitiesStepForm } from './steps/ResponsibilitiesStep'
import { ReviewStepForm } from './steps/ReviewStep'

export function OnboardForm({ initial }: { initial: IntakeSubmission }) {
  const router = useRouter()
  const [submission, setSubmission] = useState(initial)
  const [step, setStep] = useState(Math.min(INTAKE_STEP_COUNT, Math.max(1, initial.current_step)))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function persist(stepNumber: number, data: Record<string, unknown>, nextStep: number) {
    setError(null)
    const result = await saveIntakeStep({
      token: submission.token,
      step: stepNumber,
      data,
      currentStep: nextStep,
    })
    if (!result.success) {
      setError(result.error)
      return false
    }
    setSubmission(result.submission)
    setStep(nextStep)
    return true
  }

  function goBack() {
    previewStep(step - 1)
  }

  function previewStep(next: number) {
    setError(null)
    setStep(Math.min(INTAKE_STEP_COUNT, Math.max(1, next)))
  }

  const unitCount = Number(submission.payload.property?.unit_count) || 1

  return (
    <div className="cint-form-wrap">
      <div className="cint-progress">
        <div className="cint-progress-row">
          <button
            type="button"
            className="cint-step-arrow"
            aria-label="Previous section"
            disabled={step <= 1}
            onClick={() => previewStep(step - 1)}
          >
            <span aria-hidden>←</span>
          </button>
          <div className="cint-progress-main">
            <div className="cint-progress-meta">
              <span>
                Step {step} of {INTAKE_STEP_COUNT}
              </span>
              <span>{STEP_TITLES[step - 1]}</span>
            </div>
            <div className="cint-progress-bar" aria-hidden>
              <span style={{ width: `${(step / INTAKE_STEP_COUNT) * 100}%` }} />
            </div>
          </div>
          <button
            type="button"
            className="cint-step-arrow"
            aria-label="Next section"
            disabled={step >= INTAKE_STEP_COUNT}
            onClick={() => previewStep(step + 1)}
          >
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>

      {error ? <p className="cint-error" style={{ marginBottom: 12 }}>{error}</p> : null}

      <div className="cint-step-panel" hidden={step !== 1}>
        <ContactStepForm
          key={`contact-${submission.updated_at}`}
          defaultValues={submission.payload.contact}
          isSaving={isPending}
          onContinue={async (data) => {
            startTransition(async () => {
              await persist(1, data, 2)
            })
          }}
        />
      </div>

      <div className="cint-step-panel" hidden={step !== 2}>
        <PropertyStepForm
          key={`property-${submission.updated_at}`}
          defaultValues={submission.payload.property}
          isSaving={isPending}
          onBack={goBack}
          onContinue={async (data) => {
            startTransition(async () => {
              await persist(2, data, 3)
            })
          }}
        />
      </div>

      <div className="cint-step-panel" hidden={step !== 3}>
        <PropertyDetailsStepForm
          key={`details-${submission.updated_at}`}
          defaultValues={submission.payload.details}
          isSaving={isPending}
          onBack={goBack}
          onContinue={async (data) => {
            startTransition(async () => {
              await persist(3, data, 4)
            })
          }}
        />
      </div>

      <div className="cint-step-panel" hidden={step !== 4}>
        <UnitsStepForm
          key={`units-${unitCount}-${submission.updated_at}`}
          unitCount={unitCount}
          defaultValues={submission.payload.units}
          isSaving={isPending}
          onBack={goBack}
          onContinue={async (data) => {
            startTransition(async () => {
              await persist(4, data, 5)
            })
          }}
        />
      </div>

      <div className="cint-step-panel" hidden={step !== 5}>
        <UtilitiesStepForm
          key={`utils-${unitCount}-${submission.updated_at}`}
          unitCount={unitCount}
          defaultValues={submission.payload.utilities as never}
          isSaving={isPending}
          onBack={goBack}
          onContinue={async (data) => {
            startTransition(async () => {
              await persist(5, data, 6)
            })
          }}
        />
      </div>

      <div className="cint-step-panel" hidden={step !== 6}>
        <ResponsibilitiesStepForm
          key={`resp-${submission.updated_at}`}
          defaultValues={submission.payload.responsibilities}
          isSaving={isPending}
          onBack={goBack}
          onContinue={async (data) => {
            startTransition(async () => {
              await persist(6, data, 7)
            })
          }}
        />
      </div>

      <div className="cint-step-panel" hidden={step !== 7}>
        <ReviewStepForm
          payload={submission.payload}
          isSaving={isPending}
          onBack={goBack}
          onEdit={(n) => previewStep(n)}
          onUpload={async (files) => {
            const formData = new FormData()
            formData.set('token', submission.token)
            Array.from(files).forEach((file) => formData.append('files', file))
            const result = await uploadIntakePhotos(formData)
            if (!result.success) {
              setError(result.error)
              return
            }
            setSubmission((prev) => ({
              ...prev,
              payload: { ...prev.payload, photos: { paths: result.paths } },
            }))
          }}
          onSubmit={async () => {
            startTransition(async () => {
              const result = await submitIntake(submission.token)
              if (!result.success) {
                setError(result.error)
                return
              }
              router.push(`/onboard/${submission.token}/complete`)
            })
          }}
        />
      </div>
    </div>
  )
}
