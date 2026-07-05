// src/lib/email/templates/OwnerApprovalEmail.tsx
// Owner notification email for high-cost work orders requiring approval.
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

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
    <Html lang="en">
      <Head />
      <Preview>Action Required: Maintenance approval needed for {propertyAddress}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Text style={wordmarkStyle}>Canary PropOS</Text>
          </Section>

          {/* Body */}
          <Section style={sectionStyle}>
            <Heading style={headingStyle}>Maintenance Approval Required</Heading>
            <Text style={bodyTextStyle}>
              A maintenance work order for <strong>{propertyAddress}</strong> requires your
              approval before work can begin.
            </Text>

            <Hr style={hrStyle} />

            {/* Work order details */}
            <Text style={labelStyle}>Work Order Details</Text>
            <Text style={bodyTextStyle}>
              <strong>Property:</strong> {propertyAddress}
              <br />
              <strong>Work Order:</strong> {workOrderTitle}
              <br />
              <strong>Description:</strong> {workOrderDescription}
              <br />
              <strong>Estimated Cost:</strong> {formattedCost}
            </Text>

            <Hr style={hrStyle} />

            <Text style={bodyTextStyle}>
              Please review the details above and choose an action:
            </Text>

            {/* CTA buttons */}
            <Section style={buttonRowStyle}>
              <Button href={approveUrl} style={approveButtonStyle}>
                Approve Work Order
              </Button>
            </Section>
            <Section style={buttonRowStyle}>
              <Button href={declineUrl} style={declineButtonStyle}>
                Decline Work Order
              </Button>
            </Section>

            <Hr style={hrStyle} />

            <Text style={footerNoteStyle}>
              This approval link is single-use. Once you approve or decline, the link will no
              longer be valid. Approval link expires when the work order is actioned.
            </Text>
          </Section>

          <Hr style={hrStyle} />

          {/* Footer */}
          <Section>
            <Text style={footerStyle}>
              This message was sent by Canary PropOS. If you have questions, contact Canary
              Property Management directly.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default OwnerApprovalEmail

// --- Inline styles ---

const bodyStyle = {
  backgroundColor: '#FAFAF9',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  margin: '0',
  padding: '0',
}

const containerStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  margin: '32px auto',
  maxWidth: '600px',
  padding: '32px',
}

const headerStyle = {
  marginBottom: '24px',
}

const wordmarkStyle = {
  color: '#1C1917',
  fontSize: '20px',
  fontWeight: '600',
  margin: '0',
}

const sectionStyle = {
  marginBottom: '24px',
}

const headingStyle = {
  color: '#1C1917',
  fontSize: '22px',
  fontWeight: '600',
  margin: '0 0 16px 0',
}

const labelStyle = {
  color: '#78716C',
  fontSize: '12px',
  fontWeight: '600',
  letterSpacing: '0.05em',
  margin: '16px 0 4px 0',
  textTransform: 'uppercase' as const,
}

const bodyTextStyle = {
  color: '#44403C',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 8px 0',
}

const buttonRowStyle = {
  marginBottom: '12px',
}

const approveButtonStyle = {
  backgroundColor: '#16A34A',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  height: '44px',
  lineHeight: '44px',
  paddingLeft: '20px',
  paddingRight: '20px',
  textDecoration: 'none',
}

const declineButtonStyle = {
  backgroundColor: '#ffffff',
  border: '2px solid #DC2626',
  borderRadius: '6px',
  color: '#DC2626',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  height: '44px',
  lineHeight: '40px',
  paddingLeft: '20px',
  paddingRight: '20px',
  textDecoration: 'none',
}

const hrStyle = {
  borderColor: '#E7E5E4',
  margin: '20px 0',
}

const footerNoteStyle = {
  color: '#78716C',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0 0 8px 0',
}

const footerStyle = {
  color: '#A8A29E',
  fontSize: '13px',
  lineHeight: '1.4',
  margin: '0',
}
