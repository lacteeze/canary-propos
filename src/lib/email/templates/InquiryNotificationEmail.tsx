// Manager notification email when a visitor submits an inquiry or application.
import { Button, Heading, Hr, Link, Text } from '@react-email/components'
import { shortPropertyAddress } from '@/lib/addresses/short-property-address'
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
  /** Precomputed short label (street, city, province). */
  shortLabel?: string
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
    (shortLabel || '').trim() ||
    shortPropertyAddress(propertyAddress) ||
    shortPropertyAddress(listingTitle) ||
    listingTitle ||
    'Property'

  const headingPrefix =
    type === 'interest' ? 'Interest' : type === 'inquiry' ? 'Viewing' : 'Application'
  const headingText = `${headingPrefix}: ${short}`

  const detailLines: string[] = []
  if (short) detailLines.push(short)
  if (moveInDate) detailLines.push(`Move-in: ${moveInDate}`)
  if (budget) detailLines.push(`Budget: $${budget.toLocaleString()}/mo`)

  return (
    <EmailLayout
      variant="compact"
      preview={`${visitorName} · ${headingText}`}
      footerNote="Canary PM · public listing notification"
    >
      <Heading style={headingStyle}>{headingText}</Heading>

      <table width="100%" cellPadding={0} cellSpacing={0} style={gridTableStyle}>
        <tbody>
          <tr>
            <td style={colStyle} width="50%" valign="top">
              <Text style={sectionLabelStyle}>Contact</Text>
              <Text style={compactBodyStyle}>
                <strong>{visitorName}</strong>
                <br />
                <Link href={`mailto:${visitorEmail}`} style={mailtoStyle}>
                  {visitorEmail}
                </Link>
                {visitorPhone ? (
                  <>
                    <br />
                    {visitorPhone}
                  </>
                ) : null}
              </Text>
            </td>
            <td style={colRightStyle} width="50%" valign="top">
              <Text style={sectionLabelStyle}>Details</Text>
              <Text style={compactBodyStyle}>
                {detailLines.length > 0
                  ? detailLines.map((line, i) => (
                      <span key={`${i}-${line}`}>
                        {i > 0 ? <br /> : null}
                        {line}
                      </span>
                    ))
                  : '—'}
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

const headingStyle = {
  ...emailStyles.heading,
  fontSize: '20px',
  marginBottom: '16px',
}

const contentHrStyle = {
  ...emailStyles.hr,
  margin: '14px 0',
}

const gridTableStyle = {
  width: '100%' as const,
  borderCollapse: 'collapse' as const,
}

const colStyle = {
  paddingRight: '16px',
  paddingBottom: '4px',
  width: '50%',
}

const colRightStyle = {
  paddingLeft: '8px',
  paddingBottom: '4px',
  width: '50%',
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

const mailtoStyle = {
  ...emailStyles.link,
  textDecoration: 'underline' as const,
}
