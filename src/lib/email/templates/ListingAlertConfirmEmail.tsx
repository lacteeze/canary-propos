// Confirmation email for landing-page new-listing alert signups.
import { Heading, Text } from '@react-email/components'
import { emailStyles } from '@/lib/email/brand'
import { EmailLayout } from '@/lib/email/templates/EmailLayout'

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
    <EmailLayout
      preview={`You're on the list for new ${orgName} listings`}
      subtitle="Listing Alert"
      footerNote={`This confirmation was sent by Canary PM because you requested new-listing alerts on our website.`}
    >
      <Heading style={emailStyles.heading}>You&apos;re on the list</Heading>
      <Text style={emailStyles.bodyText}>
        Thanks for signing up with <strong>{orgName}</strong>. We&apos;ll email{' '}
        <strong>{subscriberEmail}</strong> when new rental homes are published — before they hit
        Facebook and Kijiji.
      </Text>
      <Text style={emailStyles.bodyText}>
        No spam. You can unsubscribe anytime by replying to this email or writing{' '}
        <strong>info@canarypm.ca</strong>.
      </Text>
      <Text style={emailStyles.bodyText}>
        Browse what&apos;s available now:{' '}
        <a href={listingsUrl} style={emailStyles.link}>
          {listingsUrl}
        </a>
      </Text>
    </EmailLayout>
  )
}

export default ListingAlertConfirmEmail
