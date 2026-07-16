// Company/manager notification when someone signs up for new-listing alerts.
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface ListingAlertNotifyEmailProps {
  subscriberEmail: string
  orgName: string
  source: string
  signedUpAt: string
}

export function ListingAlertNotifyEmail({
  subscriberEmail,
  orgName,
  source,
  signedUpAt,
}: ListingAlertNotifyEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>New listing alert signup: {subscriberEmail}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={wordmarkStyle}>Canary PropOS</Text>
          </Section>

          <Section style={sectionStyle}>
            <Heading style={headingStyle}>New listing alert signup</Heading>
            <Text style={bodyTextStyle}>
              Someone asked to be notified when {orgName} publishes new rentals.
            </Text>

            <Hr style={hrStyle} />

            <Text style={labelStyle}>Subscriber</Text>
            <Text style={bodyTextStyle}>
              <strong>Email:</strong> {subscriberEmail}
              <br />
              <strong>Source:</strong> {source}
              <br />
              <strong>Signed up:</strong> {signedUpAt}
            </Text>
          </Section>

          <Hr style={hrStyle} />

          <Section>
            <Text style={footerStyle}>
              This notification was sent because a visitor submitted the &ldquo;Notify me&rdquo;
              form on the public landing page.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default ListingAlertNotifyEmail

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
