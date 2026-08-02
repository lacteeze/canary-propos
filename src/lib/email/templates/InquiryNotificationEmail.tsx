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
  /** Short street form for subject/heading (e.g. before first comma). */
  shortLabel?: string
}

function shortAddress(addr: string | null | undefined, fallback = ''): string {
  const s = (addr || '').split(',')[0].trim()
  return s || fallback
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
  shortLabel,
}: InquiryNotificationEmailProps) {
  const short =
    shortLabel ||
    shortAddress(propertyAddress, shortAddress(listingTitle, listingTitle || 'Property'))

  const headingPrefix =
    type === 'interest' ? 'Interest' : type === 'inquiry' ? 'Viewing' : 'Application'
  const headingText = `${headingPrefix}: ${short}`
  const subtitle =
    type === 'interest'
      ? 'General Interest'
      : type === 'inquiry'
        ? 'Viewing Request'
        : 'Application Interest'
  const typeLabel =
    type === 'interest'
      ? 'general interest'
      : type === 'inquiry'
        ? 'viewing request'
        : 'application interest'

  return (
    <EmailLayout
      preview={`${headingText} — ${visitorName}`}
      subtitle={subtitle}
      footerNote={`Canary PM notification: ${typeLabel} on your public site.`}
    >
      <Heading style={{ ...emailStyles.heading, marginBottom: '12px' }}>{headingText}</Heading>

      <table width="100%" cellPadding={0} cellSpacing={0} style={gridTableStyle}>
        <tbody>
          <tr>
            <td style={colStyle} width="50%" valign="top">
              <Text style={sectionLabelStyle}>Contact</Text>
              <Text style={compactBodyStyle}>
                <strong>{visitorName}</strong>
                <br />
                {visitorEmail}
                {visitorPhone ? (
                  <>
                    <br />
                    {visitorPhone}
                  </>
                ) : null}
              </Text>
            </td>
            <td style={colStyle} width="50%" valign="top">
              <Text style={sectionLabelStyle}>Details</Text>
              <Text style={compactBodyStyle}>
                {propertyAddress || listingTitle ? (
                  <>
                    {propertyAddress || listingTitle}
                    <br />
                  </>
                ) : null}
                {moveInDate ? (
                  <>
                    Move-in: {moveInDate}
                    <br />
                  </>
                ) : null}
                {budget ? <>Budget: ${budget.toLocaleString()}/mo</> : null}
                {!moveInDate && !budget && !propertyAddress && !listingTitle ? '—' : null}
              </Text>
            </td>
          </tr>
        </tbody>
      </table>

      {note ? (
        <>
          <Hr style={contentHrStyle} />
          <Text style={sectionLabelStyle}>Message</Text>
          <Text style={compactBodyStyle}>{note}</Text>
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
  margin: '14px 0',
}

const gridTableStyle = {
  width: '100%' as const,
  borderCollapse: 'collapse' as const,
}

const colStyle = {
  paddingRight: '12px',
  paddingBottom: '4px',
}

const sectionLabelStyle = {
  ...emailStyles.label,
  margin: '0 0 4px 0',
}

const compactBodyStyle = {
  ...emailStyles.bodyText,
  margin: '0',
  lineHeight: '1.45',
}
