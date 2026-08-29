import { Button, Heading, Text } from '@react-email/components'
import { emailStyles } from '@/lib/email/brand'
import { EmailLayout } from '@/lib/email/templates/EmailLayout'

export interface IntakeStaffNotifyEmailProps {
  contactName: string
  contactEmail: string
  contactPhone?: string | null
  propertyAddress?: string | null
  detailUrl: string
}

export function IntakeStaffNotifyEmail({
  contactName,
  contactEmail,
  contactPhone,
  propertyAddress,
  detailUrl,
}: IntakeStaffNotifyEmailProps) {
  return (
    <EmailLayout
      preview={`New client intake: ${contactName || contactEmail}`}
      subtitle="New intake"
      footerNote="Client intake form — read-only in the app until promotion ships."
    >
      <Heading style={emailStyles.heading}>New client intake submitted</Heading>
      <Text style={emailStyles.bodyText}>
        <strong>{contactName || 'Unnamed'}</strong>
        <br />
        {contactEmail}
        {contactPhone ? (
          <>
            <br />
            {contactPhone}
          </>
        ) : null}
      </Text>
      {propertyAddress ? (
        <Text style={emailStyles.bodyText}>{propertyAddress}</Text>
      ) : null}
      <Button href={detailUrl} style={emailStyles.cta}>
        Open submission
      </Button>
    </EmailLayout>
  )
}

export default IntakeStaffNotifyEmail
