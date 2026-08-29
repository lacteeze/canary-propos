import { Heading, Text } from '@react-email/components'
import { emailStyles } from '@/lib/email/brand'
import { EmailLayout } from '@/lib/email/templates/EmailLayout'

export interface IntakeConfirmationEmailProps {
  contactName: string
  propertyAddress?: string | null
  orgName: string
}

export function IntakeConfirmationEmail({
  contactName,
  propertyAddress,
  orgName,
}: IntakeConfirmationEmailProps) {
  return (
    <EmailLayout
      preview="We received your property details"
      subtitle="Onboarding"
      footerNote={`Submitted to ${orgName}. We'll be in touch if we need anything else.`}
    >
      <Heading style={emailStyles.heading}>We&apos;ve got it</Heading>
      <Text style={emailStyles.bodyText}>
        Thanks{contactName ? `, ${contactName}` : ''}. Your intake is submitted
        {propertyAddress ? (
          <>
            {' '}
            for <strong>{propertyAddress}</strong>
          </>
        ) : null}
        .
      </Text>
      <Text style={emailStyles.bodyText}>
        The {orgName} team will review what you sent and follow up about next steps — management
        agreement, listing, and move-in details.
      </Text>
      <Text style={emailStyles.bodyText}>No further action is needed from you right now.</Text>
    </EmailLayout>
  )
}

export default IntakeConfirmationEmail
