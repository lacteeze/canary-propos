// src/lib/email/templates/TeamInviteEmail.tsx
// Team member invite email for managers / employees
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

export interface TeamInviteEmailProps {
  inviteeEmail: string
  orgName: string
  role: string // "manager" | "employee"
  signUpUrl: string
}

export function TeamInviteEmail({
  inviteeEmail,
  orgName,
  role,
  signUpUrl,
}: TeamInviteEmailProps) {
  const roleLabel = role === 'manager' ? 'a manager' : 'an employee'

  return (
    <Html lang="en">
      <Head />
      <Preview>
        You've been invited to join {orgName} as {roleLabel}
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
              You've been invited to join {orgName}
            </Heading>
            <Text style={bodyTextStyle}>
              You've been invited to join {orgName} as {roleLabel}. Click the button below to
              create your account and access your workspace.
            </Text>
            <Text style={bodyTextStyle}>
              Your account will be set up with the email address:{' '}
              <strong>{inviteeEmail}</strong>
            </Text>

            <Button href={signUpUrl} style={ctaButtonStyle}>
              Accept invite
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

export default TeamInviteEmail

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
