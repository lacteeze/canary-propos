// Shared transactional email chrome — matches public landing brand (light, ink header, sage CTA).
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'
import { EMAIL_CONTACT, emailColors, emailStyles } from '@/lib/email/brand'

const headerWithAccent = {
  ...emailStyles.header,
  borderBottom: `3px solid ${emailColors.yellow}`,
}

const compactContainer = {
  ...emailStyles.container,
  maxWidth: '640px',
}

const compactContent = {
  ...emailStyles.content,
  padding: '24px 28px 20px',
}

const compactFooter = {
  ...emailStyles.footerSection,
  padding: '16px 28px 20px',
}

export interface EmailLayoutProps {
  preview: string
  children: ReactNode
  /** Optional context line above the contact footer. */
  footerNote?: string
  /** Header wordmark — defaults to public sender brand. */
  brandName?: string
  /**
   * Purpose line under the wordmark (e.g. "Showing Request").
   * Required for the default (branded) variant; ignored when variant="compact".
   */
  subtitle?: string
  /**
   * default — dark brand header + subtitle.
   * compact — no dark header; wider container for dense 2-column content.
   */
  variant?: 'default' | 'compact'
}

export function EmailLayout({
  preview,
  children,
  footerNote,
  brandName = 'Canary PM',
  subtitle,
  variant = 'default',
}: EmailLayoutProps) {
  const compact = variant === 'compact'

  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailStyles.body}>
        <Container style={compact ? compactContainer : emailStyles.container}>
          {!compact ? (
            <Section style={headerWithAccent}>
              <Text style={emailStyles.wordmark}>{brandName}</Text>
              {subtitle ? <Text style={emailStyles.tagline}>{subtitle}</Text> : null}
            </Section>
          ) : null}

          <Section style={compact ? compactContent : emailStyles.content}>{children}</Section>

          <Hr style={emailStyles.hr} />

          <Section style={compact ? compactFooter : emailStyles.footerSection}>
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
