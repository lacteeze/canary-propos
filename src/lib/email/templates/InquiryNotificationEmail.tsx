// Manager notification email when a visitor submits an inquiry or application.
import { Button, Heading, Hr, Text } from '@react-email/components'
import { emailStyles } from '@/lib/email/brand'
import { EmailLayout } from '@/lib/email/templates/EmailLayout'

export interface InquiryNotificationEmailProps {
  visitorName: string
  visitorEmail: string
  visitorPhone?: string | null
  listingTitle: string
  propertyAddress: string
  type: 'inquiry' | 'application' | 'interest'
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
  const typeLabel =
    type === 'interest'
      ? 'general interest'
      : type === 'inquiry'
        ? 'viewing request'
        : 'application interest'
  const subtitle =
    type === 'interest'
      ? 'General Interest Submitted'
      : type === 'inquiry'
        ? 'Viewing Request'
        : 'Application Interest Submitted'
  const headingText =
    type === 'interest'
      ? `New general interest — ${listingTitle}`
      : type === 'inquiry'
        ? `New viewing request — ${listingTitle}`
        : `New application interest — ${listingTitle}`
  const locationPhrase =
    type === 'interest'
      ? propertyAddress
        ? (
            <>
              related to <strong>{propertyAddress}</strong>
            </>
          )
        : (
            <>
              for <strong>{listingTitle}</strong>
            </>
          )
      : (
          <>
            from the listing at <strong>{propertyAddress}</strong>
          </>
        )

  return (
    <EmailLayout
      preview={`${visitorName} submitted a ${typeLabel} for ${listingTitle}`}
      subtitle={subtitle}
      footerNote={`This notification was sent by Canary PM because a visitor submitted a ${typeLabel} on your public site.`}
    >
      <Heading style={emailStyles.heading}>{headingText}</Heading>
      <Text style={emailStyles.bodyText}>
        You have a new {typeLabel} {locationPhrase}.
      </Text>

      <Hr style={contentHrStyle} />

      <Text style={emailStyles.label}>Contact information</Text>
      <Text style={emailStyles.bodyText}>
        <strong>Name:</strong> {visitorName}
        <br />
        <strong>Email:</strong> {visitorEmail}
        {visitorPhone ? (
          <>
            <br />
            <strong>Phone:</strong> {visitorPhone}
          </>
        ) : null}
      </Text>

      {moveInDate || budget ? (
        <>
          <Text style={emailStyles.label}>Details</Text>
          <Text style={emailStyles.bodyText}>
            {moveInDate ? (
              <>
                <strong>Desired move-in:</strong> {moveInDate}
                <br />
              </>
            ) : null}
            {budget ? (
              <>
                <strong>Monthly budget:</strong> ${budget.toLocaleString()}
              </>
            ) : null}
          </Text>
        </>
      ) : null}

      {note ? (
        <>
          <Text style={emailStyles.label}>Message</Text>
          <Text style={emailStyles.bodyText}>{note}</Text>
        </>
      ) : null}

      <Hr style={contentHrStyle} />

      <Button href={dashboardUrl} style={emailStyles.cta}>
        View in dashboard
      </Button>
    </EmailLayout>
  )
}

export default InquiryNotificationEmail

const contentHrStyle = {
  ...emailStyles.hr,
  margin: '20px 0',
}
