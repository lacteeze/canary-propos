// Company/manager notification when someone signs up for new-listing alerts.
import { Heading, Hr, Text } from '@react-email/components'
import { emailStyles } from '@/lib/email/brand'
import { EmailLayout } from '@/lib/email/templates/EmailLayout'

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
    <EmailLayout
      preview={`New listing alert signup: ${subscriberEmail}`}
      subtitle="Listing Alert Signup"
      footerNote='This notification was sent because a visitor submitted the "Notify me" form on the public landing page.'
    >
      <Heading style={emailStyles.heading}>New listing alert signup</Heading>
      <Text style={emailStyles.bodyText}>
        Someone asked to be notified when {orgName} publishes new rentals.
      </Text>

      <Hr style={contentHrStyle} />

      <Text style={emailStyles.label}>Subscriber</Text>
      <Text style={emailStyles.bodyText}>
        <strong>Email:</strong> {subscriberEmail}
        <br />
        <strong>Source:</strong> {source}
        <br />
        <strong>Signed up:</strong> {signedUpAt}
      </Text>
    </EmailLayout>
  )
}

export default ListingAlertNotifyEmail

const contentHrStyle = {
  ...emailStyles.hr,
  margin: '20px 0',
}
