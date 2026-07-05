// src/lib/email/templates/InquiryNotificationEmail.tsx
// Manager notification email when a visitor submits an inquiry or application.
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

export interface InquiryNotificationEmailProps {
  visitorName: string
  visitorEmail: string
  visitorPhone?: string | null
  listingTitle: string
  propertyAddress: string
  type: 'inquiry' | 'application'
  moveInDate?: string | null
  budget?: number | null
  note?: string | null
  dashboardUrl: string
}

export function InquiryNotificationEmail({
  visitorName,
  visitorEmail,
  visitorPhone,
  listingTitle,
  propertyAddress,
  type,
  moveInDate,
  budget,
  note,
  dashboardUrl,
}: InquiryNotificationEmailProps) {
  const typeLabel = type === 'inquiry' ? 'showing request' : 'application interest'
  const headingText =
    type === 'inquiry'
      ? `New showing request — ${listingTitle}`
      : `New application interest — ${listingTitle}`

  return (
    <Html lang="en">
      <Head />
      <Preview>
        {visitorName} submitted a {typeLabel} for {listingTitle}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Text style={wordmarkStyle}>Canary PropOS</Text>
          </Section>

          {/* Body */}
          <Section style={sectionStyle}>
            <Heading style={headingStyle}>{headingText}</Heading>
            <Text style={bodyTextStyle}>
              You have a new {typeLabel} from the listing at{' '}
              <strong>{propertyAddress}</strong>.
            </Text>

            <Hr style={hrStyle} />

            {/* Contact block */}
            <Text style={labelStyle}>Contact information</Text>
            <Text style={bodyTextStyle}>
              <strong>Name:</strong> {visitorName}
              <br />
              <strong>Email:</strong> {visitorEmail}
              {visitorPhone && (
                <>
                  <br />
                  <strong>Phone:</strong> {visitorPhone}
                </>
              )}
            </Text>

            {/* Move-in / budget */}
            {(moveInDate || budget) && (
              <>
                <Text style={labelStyle}>Details</Text>
                <Text style={bodyTextStyle}>
                  {moveInDate && (
                    <>
                      <strong>Desired move-in:</strong> {moveInDate}
                      <br />
                    </>
                  )}
                  {budget && (
                    <>
                      <strong>Monthly budget:</strong> ${budget.toLocaleString()}
                    </>
                  )}
                </Text>
              </>
            )}

            {/* Note */}
            {note && (
              <>
                <Text style={labelStyle}>Message</Text>
                <Text style={bodyTextStyle}>{note}</Text>
              </>
            )}

            <Hr style={hrStyle} />

            <Button href={dashboardUrl} style={ctaButtonStyle}>
              View in dashboard
            </Button>
          </Section>

          <Hr style={hrStyle} />

          {/* Footer */}
          <Section>
            <Text style={footerStyle}>
              This notification was sent by Canary PropOS because a visitor submitted a{' '}
              {typeLabel} on your public listings page.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default InquiryNotificationEmail

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

const ctaButtonStyle = {
  backgroundColor: '#D97706',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  height: '44px',
  lineHeight: '44px',
  marginTop: '8px',
  paddingLeft: '20px',
  paddingRight: '20px',
  textDecoration: 'none',
}

const hrStyle = {
  borderColor: '#E7E5E4',
  margin: '20px 0',
}

const footerStyle = {
  color: '#A8A29E',
  fontSize: '13px',
  lineHeight: '1.4',
  margin: '0',
}
