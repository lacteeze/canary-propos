import { Button, Heading, Text } from '@react-email/components'
import { emailStyles } from '@/lib/email/brand'
import { EmailLayout } from '@/lib/email/templates/EmailLayout'

export interface IntakeResumeEmailProps {
  contactName: string
  resumeUrl: string
  orgName: string
}

export function IntakeResumeEmail({
  contactName,
  resumeUrl,
  orgName,
}: IntakeResumeEmailProps) {
  return (
    <EmailLayout
      preview="Continue your property intake whenever you're ready"
      subtitle="Onboarding"
      footerNote={`This link was sent because you started an intake form with ${orgName}.`}
    >
      <Heading style={emailStyles.heading}>Pick up where you left off</Heading>
      <Text style={emailStyles.bodyText}>
        Hi {contactName || 'there'}, thanks for starting your property details with{' '}
        <strong>{orgName}</strong>. You can close this and come back later — your answers are
        saved.
      </Text>
      <Text style={emailStyles.bodyText}>
        Use this private link to continue. Don&apos;t share it; it opens your form.
      </Text>
      <Button href={resumeUrl} style={emailStyles.cta}>
        Continue intake
      </Button>
      <Text style={emailStyles.muted}>{resumeUrl}</Text>
    </EmailLayout>
  )
}

export default IntakeResumeEmail
