// Shared transactional email chrome — matches public landing brand (light, ink header, sage CTA).
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'
import { EMAIL_CONTACT, emailColors, emailStyles } from '@/lib/email/brand'

const headerWithAccent = {
  ...emailStyles.header,
  borderBottom: `3px solid ${emailColors.yellow}`,
}

export interface EmailLayoutProps {
  preview: string
  children: ReactNode
  /** Optional context line above the contact footer. */
  footerNote?: string
  /** Header wordmark — defaults to public sender brand. */
  brandName?: string
  /** Purpose line under the wordmark (e.g. "Showing Request"). */
  subtitle: string
}

export function EmailLayout({
  preview,
  children,
  footerNote,
  brandName = 'Canary PM',
  subtitle,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={headerWithAccent}>
            <Text style={emailStyles.wordmark}>{brandName}</Text>
            <Text style={emailStyles.tagline}>{subtitle}</Text>
          </Section>

          <Section style={emailStyles.content}>{children}</Section>

          <Hr style={emailStyles.hr} />

          <Section style={emailStyles.footerSection}>
            {footerNote ? <Text style={emailStyles.footerNote}>{footerNote}</Text> : null}
            <Text style={emailStyles.footerContact}>
              <a href={`mailto:${EMAIL_CONTACT.email}`} style={contactLinkStyle}>
                {EMAIL_CONTACT.email}
              </a>
              {' · '}
              <a href={`tel:${EMAIL_CONTACT.phoneTel}`} style={contactLinkStyle}>
                {EMAIL_CONTACT.phoneDisplay}
              </a>
            </Text>
            <Text style={emailStyles.footerFine}>
              © Canary Property Management · St. John&apos;s, NL
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default EmailLayout

const contactLinkStyle = {
  color: emailColors.accent,
  textDecoration: 'none',
}
