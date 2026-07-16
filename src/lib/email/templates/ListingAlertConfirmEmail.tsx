// Confirmation email for landing-page new-listing alert signups.
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

export interface ListingAlertConfirmEmailProps {
  orgName: string
  subscriberEmail: string
  listingsUrl: string
}

export function ListingAlertConfirmEmail({
  orgName,
  subscriberEmail,
  listingsUrl,
}: ListingAlertConfirmEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>You&apos;re on the list for new {orgName} listings</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={wordmarkStyle}>{orgName}</Text>
          </Section>

          <Section style={sectionStyle}>
            <Heading style={headingStyle}>You&apos;re on the list</Heading>
            <Text style={bodyTextStyle}>
              Thanks for signing up. We&apos;ll email <strong>{subscriberEmail}</strong> when
              new rental homes are published — before they hit Facebook and Kijiji.
            </Text>
            <Text style={bodyTextStyle}>
              No spam. You can unsubscribe anytime by replying to this email or writing{' '}
              <strong>info@canarypm.ca</strong>.
            </Text>
            <Text style={bodyTextStyle}>
              Browse what&apos;s available now:{' '}
              <a href={listingsUrl} style={linkStyle}>
                {listingsUrl}
              </a>
            </Text>
          </Section>

          <Hr style={hrStyle} />

          <Section>
            <Text style={footerStyle}>
              This confirmation was sent by {orgName} because you requested new-listing alerts
              on our website.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default ListingAlertConfirmEmail

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

const bodyTextStyle = {
  color: '#44403C',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 12px 0',
}

const linkStyle = {
  color: '#D97706',
  fontWeight: '600' as const,
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
