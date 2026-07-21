// Tenant invite email — property address + unit + move-in date (D-07)
import { Button, Heading, Section, Text } from '@react-email/components'
import { emailStyles } from '@/lib/email/brand'
import { EmailLayout } from '@/lib/email/templates/EmailLayout'

export interface TenantInviteEmailProps {
  tenantFirstName: string
  orgName: string
  propertyAddress: string
  unitNumber: string
  moveInDate: string // formatted display string e.g. "January 15, 2025"
  signUpUrl: string
}

export function TenantInviteEmail({
  tenantFirstName,
  orgName,
  propertyAddress,
  unitNumber,
  moveInDate,
  signUpUrl,
}: TenantInviteEmailProps) {
  return (
    <EmailLayout
      preview={`${orgName} has invited you to manage your tenancy at ${propertyAddress}`}
      subtitle="Tenant Invite"
      footerNote={`This invite was sent by ${orgName}. If you didn't expect this email, you can ignore it.`}
    >
      <Heading style={emailStyles.heading}>Hi {tenantFirstName},</Heading>
      <Text style={emailStyles.bodyText}>
        {orgName} has invited you to manage your tenancy at:
      </Text>

      <Section style={emailStyles.callout}>
        <Text style={emailStyles.calloutLine}>{propertyAddress}</Text>
        <Text style={emailStyles.calloutLine}>Unit {unitNumber}</Text>
        <Text style={emailStyles.calloutLine}>Move-in date: {moveInDate}</Text>
      </Section>

      <Text style={emailStyles.bodyText}>
        Click the button below to create your account and access your tenant portal.
      </Text>

      <Button href={signUpUrl} style={emailStyles.cta}>
        Set up my account
      </Button>
    </EmailLayout>
  )
}

export default TenantInviteEmail
