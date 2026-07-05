// src/lib/email/templates/TenantInviteEmail.tsx
// Tenant invite email — property address + unit + move-in date (D-07)
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
    <Html lang="en">
      <Head />
      <Preview>
        {orgName} has invited you to manage your tenancy at {propertyAddress}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header / Wordmark */}
          <Section style={headerStyle}>
            <Text style={wordmarkStyle}>{orgName}</Text>
          </Section>

          {/* Body */}
          <Section style={sectionStyle}>
            <Heading style={headingStyle}>
              Hi {tenantFirstName},
            </Heading>
            <Text style={bodyTextStyle}>
              {orgName} has invited you to manage your tenancy at:
            </Text>

            {/* Property block */}
            <Section style={propertyBlockStyle}>
              <Text style={propertyLineStyle}>{propertyAddress}</Text>
              <Text style={propertyLineStyle}>Unit {unitNumber}</Text>
              <Text style={propertyLineStyle}>Move-in date: {moveInDate}</Text>
            </Section>

            <Text style={bodyTextStyle}>
              Click the button below to create your account and access your tenant portal.
            </Text>

            <Button href={signUpUrl} style={ctaButtonStyle}>
              Set up my account
            </Button>
          </Section>

          <Hr style={hrStyle} />

          {/* Footer */}
          <Section>
            <Text style={footerStyle}>
              This invite was sent by {orgName}. If you didn&apos;t expect this email, you can ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default TenantInviteEmail

// --- Inline styles (react-email uses inline styles for email client compatibility) ---

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
  fontSize: '24px',
  fontWeight: '600',
  margin: '0 0 16px 0',
}

const bodyTextStyle = {
  color: '#44403C',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 16px 0',
}

const propertyBlockStyle = {
  backgroundColor: '#F5F4F2',
  borderLeft: '4px solid #D97706',
  borderRadius: '4px',
  margin: '0 0 24px 0',
  padding: '16px',
}

const propertyLineStyle = {
  color: '#1C1917',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '1.5',
  margin: '0',
}

const ctaButtonStyle = {
  backgroundColor: '#D97706',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  height: '48px',
  lineHeight: '48px',
  paddingLeft: '24px',
  paddingRight: '24px',
  textDecoration: 'none',
}

const hrStyle = {
  borderColor: '#E7E5E4',
  margin: '24px 0',
}

const footerStyle = {
  color: '#A8A29E',
  fontSize: '14px',
  lineHeight: '1.4',
  margin: '0',
}
