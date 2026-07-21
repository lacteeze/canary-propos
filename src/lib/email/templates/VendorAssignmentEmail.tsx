// Vendor notification when a work order is assigned.
import { Button, Heading, Hr, Text } from '@react-email/components'
import { emailStyles } from '@/lib/email/brand'
import { EmailLayout } from '@/lib/email/templates/EmailLayout'

export interface VendorAssignmentEmailProps {
  propertyAddress: string
  workOrderTitle: string
  workOrderDescription: string
  noLoginLink: string
}

export function VendorAssignmentEmail({
  propertyAddress,
  workOrderTitle,
  workOrderDescription,
  noLoginLink,
}: VendorAssignmentEmailProps) {
  return (
    <EmailLayout
      preview={`New work order: ${workOrderTitle} — ${propertyAddress}`}
      subtitle="Work Order Assignment"
      footerNote="This notification was sent by Canary PM. If you have questions, contact Canary Property Management."
    >
      <Heading style={emailStyles.heading}>New Work Order</Heading>
      <Text style={emailStyles.bodyText}>
        You have been assigned a new work order from Canary Property Management.
      </Text>

      <Hr style={contentHrStyle} />

      <Text style={emailStyles.label}>Job details</Text>
      <Text style={emailStyles.bodyText}>
        <strong>Property:</strong> {propertyAddress}
        <br />
        <strong>Work Order:</strong> {workOrderTitle}
        <br />
        <strong>Description:</strong> {workOrderDescription}
      </Text>

      <Text style={emailStyles.bodyText}>
        Use the link below to view full job details and update your status:
      </Text>

      <Button href={noLoginLink} style={emailStyles.cta}>
        View Job Details
      </Button>
    </EmailLayout>
  )
}

export default VendorAssignmentEmail

const contentHrStyle = {
  ...emailStyles.hr,
  margin: '20px 0',
}
