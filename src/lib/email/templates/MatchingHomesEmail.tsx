// Tenant-facing email: matching published homes styled like public listing cards.
import { Button, Heading, Img, Link, Text } from '@react-email/components'
import { EMAIL_CONTACT, emailColors, emailFonts, emailStyles } from '@/lib/email/brand'
import { EmailLayout } from '@/lib/email/templates/EmailLayout'

export type MatchingHomeEmailCard = {
  href: string
  shortAddress: string
  rentFormatted: string
  beds: number
  bathsLabel: string
  parking: string
  termBadge: string
  tags: string[]
  photoUrl: string | null
}

export interface MatchingHomesEmailProps {
  recipientName: string
  homes: MatchingHomeEmailCard[]
  browseUrl: string
}

function termBadgeLabel(raw: string): string {
  const t = raw.trim().toUpperCase()
  if (t.includes('MID')) return 'MID TERM'
  if (t.includes('SHORT')) return 'SHORT TERM'
  return 'LONG TERM'
}

export function MatchingHomesEmail({
  recipientName,
  homes,
  browseUrl,
}: MatchingHomesEmailProps) {
  const firstName = recipientName.trim().split(/\s+/)[0] || 'there'
  const count = homes.length
  const preview =
    count === 1
      ? `A home that matches what you're looking for`
      : `${count} homes that match what you're looking for`

  return (
    <EmailLayout
      preview={preview}
      subtitle="Homes for you"
      footerNote="You're receiving this because you inquired about a Canary home. Reply to this email anytime — we'd love to help you find the right fit."
    >
      <Heading style={emailStyles.heading}>
        {count === 1 ? 'A home that fits' : 'Homes that fit'}
      </Heading>
      <Text style={emailStyles.bodyText}>
        Hi {firstName}, here {count === 1 ? 'is a listing' : `are ${count} listings`} currently
        available that look like a good match for what you&apos;re looking for. Tap any home to
        see photos, details, and request a viewing.
      </Text>

      {homes.map((home) => (
        <ListingCard key={home.href + home.shortAddress} home={home} />
      ))}

      <Text style={{ ...emailStyles.muted, marginTop: '8px', marginBottom: '18px' }}>
        Prefer to browse everything on the market?{' '}
        <Link href={browseUrl} style={emailStyles.link}>
          See all available homes
        </Link>
        .
      </Text>

      <Button href={`mailto:${EMAIL_CONTACT.leasing}`} style={emailStyles.cta}>
        Reply to leasing
      </Button>
    </EmailLayout>
  )
}

function ListingCard({ home }: { home: MatchingHomeEmailCard }) {
  const badge = termBadgeLabel(home.termBadge)
  const tags = home.tags.slice(0, 3)

  return (
    <table
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      role="presentation"
      style={cardTableStyle}
    >
      <tbody>
        <tr>
          <td style={mediaCellStyle}>
            {home.photoUrl ? (
              <Link href={home.href}>
                <Img
                  src={home.photoUrl}
                  alt=""
                  width={496}
                  height={190}
                  style={photoStyle}
                />
              </Link>
            ) : (
              <Link href={home.href} style={{ textDecoration: 'none' }}>
                <div style={photoPlaceholderStyle}>
                  <span style={photoPlaceholderTextStyle}>Photos coming soon</span>
                </div>
              </Link>
            )}
          </td>
        </tr>
        <tr>
          <td style={bodyCellStyle}>
            <Text style={badgeStyle}>{badge}</Text>
            <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
              <tbody>
                <tr>
                  <td style={addressStyle}>{home.shortAddress}</td>
                  <td align="right" style={rentStyle}>
                    {home.rentFormatted}
                    <span style={rentSuffixStyle}>/mo</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <Text style={metaStyle}>
              <strong style={metaStrongStyle}>{home.beds}</strong> bed
              {' · '}
              <strong style={metaStrongStyle}>{home.bathsLabel}</strong> bath
              {' · '}
              <strong style={metaStrongStyle}>{home.parking}</strong> park
            </Text>
            {tags.length > 0 ? (
              <table cellPadding={0} cellSpacing={0} role="presentation" style={tagsRowStyle}>
                <tbody>
                  <tr>
                    {tags.map((tag) => (
                      <td key={tag} style={tagCellStyle}>
                        <span
                          style={
                            tag === 'Utilities included' || tag === 'POU'
                              ? tagValueStyle
                              : tagStyle
                          }
                        >
                          {tag}
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            ) : null}
            <Text style={viewLinkWrapStyle}>
              <Link href={home.href} style={viewLinkStyle}>
                View listing →
              </Link>
            </Text>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export default MatchingHomesEmail

const cardTableStyle = {
  width: '100%' as const,
  borderCollapse: 'collapse' as const,
  backgroundColor: emailColors.elev,
  border: `1px solid ${emailColors.border}`,
  borderRadius: '14px',
  margin: '0 0 18px 0',
  overflow: 'hidden' as const,
}

const mediaCellStyle = {
  backgroundColor: emailColors.panel,
  padding: '0',
  lineHeight: '0',
}

const photoStyle = {
  display: 'block' as const,
  width: '100%' as const,
  maxWidth: '496px',
  height: '190px',
  objectFit: 'cover' as const,
  border: '0',
}

const photoPlaceholderStyle = {
  display: 'block' as const,
  height: '190px',
  backgroundColor: emailColors.panel,
  borderBottom: `1px solid ${emailColors.border}`,
  textAlign: 'center' as const,
  lineHeight: '190px',
}

const photoPlaceholderTextStyle = {
  fontFamily: emailFonts.sans,
  fontSize: '14px',
  fontWeight: '600' as const,
  letterSpacing: '0.02em',
  color: emailColors.dim,
}

const badgeStyle = {
  display: 'inline-block' as const,
  backgroundColor: emailColors.ink,
  color: emailColors.inkText,
  fontFamily: emailFonts.sans,
  fontSize: '11px',
  fontWeight: '700' as const,
  letterSpacing: '0.05em',
  padding: '5px 11px',
  borderRadius: '999px',
  lineHeight: '1.2',
  margin: '0 0 10px 0',
}

const bodyCellStyle = {
  padding: '15px 17px 16px',
}

const addressStyle = {
  fontFamily: emailFonts.sans,
  fontSize: '16px',
  fontWeight: '700' as const,
  color: emailColors.text,
  lineHeight: '1.3',
  padding: '0',
  paddingRight: '8px',
}

const rentStyle = {
  fontFamily: emailFonts.sans,
  fontSize: '16px',
  fontWeight: '700' as const,
  color: emailColors.accent,
  lineHeight: '1.3',
  whiteSpace: 'nowrap' as const,
  padding: '0',
}

const rentSuffixStyle = {
  color: emailColors.faint,
  fontWeight: '500' as const,
  fontSize: '12px',
}

const metaStyle = {
  fontFamily: emailFonts.sans,
  fontSize: '13px',
  color: emailColors.dim,
  margin: '8px 0 0 0',
  lineHeight: '1.4',
}

const metaStrongStyle = {
  color: emailColors.text,
  fontWeight: '700' as const,
}

const tagsRowStyle = {
  marginTop: '10px',
  borderCollapse: 'separate' as const,
  borderSpacing: '0 0',
}

const tagCellStyle = {
  padding: '0 6px 0 0',
  verticalAlign: 'middle' as const,
}

const tagStyle = {
  display: 'inline-block' as const,
  fontFamily: emailFonts.sans,
  fontSize: '11px',
  fontWeight: '600' as const,
  color: emailColors.dim,
  backgroundColor: emailColors.panel,
  border: `1px solid ${emailColors.border}`,
  borderRadius: '999px',
  padding: '4px 10px',
  lineHeight: '1.2',
}

const tagValueStyle = {
  ...tagStyle,
  color: emailColors.accent,
  borderColor: emailColors.border2,
  backgroundColor: '#f2f6f0',
}

const viewLinkWrapStyle = {
  margin: '12px 0 0 0',
  fontFamily: emailFonts.sans,
  fontSize: '13px',
  lineHeight: '1.4',
}

const viewLinkStyle = {
  color: emailColors.accent,
  fontWeight: '700' as const,
  textDecoration: 'none' as const,
}
