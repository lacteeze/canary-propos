// Owner notification email for high-cost work orders requiring approval.
import { Button, Heading, Hr, Section, Text } from '@react-email/components'
import { emailStyles } from '@/lib/email/brand'
import { EmailLayout } from '@/lib/email/templates/EmailLayout'

export interface OwnerApprovalEmailProps {
  propertyAddress: string
  workOrderTitle: string
  workOrderDescription: string
  estimatedCost: number
  approveUrl: string
  declineUrl: string
}

export function OwnerApprovalEmail({
  propertyAddress,
  workOrderTitle,
  workOrderDescription,
  estimatedCost,
  approveUrl,
  declineUrl,
}: OwnerApprovalEmailProps) {
  const formattedCost = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(estimatedCost)

  return (
    <EmailLayout
      preview={`Action Required: Maintenance approval needed for ${propertyAddress}`}
      subtitle="Approval Required"
      footerNote="This message was sent by Canary PM. If you have questions, contact your property manager or Canary Property Management."
    >
      <Heading style={emailStyles.heading}>Maintenance Approval Required</Heading>
      <Text style={emailStyles.bodyText}>
        A maintenance work order for <strong>{propertyAddress}</strong> requires your approval
        before work can begin.
      </Text>

      <Hr style={contentHrStyle} />

      <Text style={emailStyles.label}>Work Order Details</Text>
      <Text style={emailStyles.bodyText}>
        <strong>Property:</strong> {propertyAddress}
        <br />
        <strong>Work Order:</strong> {workOrderTitle}
        <br />
        <strong>Description:</strong> {workOrderDescription}
        <br />
        <strong>Estimated Cost:</strong> {formattedCost}
      </Text>

      <Hr style={contentHrStyle} />

      <Text style={emailStyles.bodyText}>Please review the details above and choose an action:</Text>

      <Section style={buttonRowStyle}>
        <Button href={approveUrl} style={emailStyles.cta}>
          Approve Work Order
        </Button>
      </Section>
      <Section style={buttonRowStyle}>
        <Button href={declineUrl} style={emailStyles.ctaSecondary}>
          Decline Work Order
        </Button>
      </Section>

      <Text style={emailStyles.muted}>
        This approval link is single-use. Once you approve or decline, the link will no longer be
        valid. Approval link expires when the work order is actioned.
      </Text>
    </EmailLayout>
  )
}

export default OwnerApprovalEmail

const contentHrStyle = {
  ...emailStyles.hr,
  margin: '20px 0',
}

const buttonRowStyle = {
  marginBottom: '12px',
}
