import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'

export const metadata: Metadata = {
  title: 'Privacy Policy | Canary Property Management',
  description:
    'How Canary Property Management collects, uses, and stores information in Canary PropOS, including Google Gmail, Drive, and Tasks connections.',
}

const updated = '3 September 2026'

export default function PrivacyPolicyPage() {
  return (
    <>
      <PublicHeader />
      <style>{`
        .privacy-doc a { color: var(--text); font-weight: 600; text-underline-offset: 2px; }
        .privacy-doc ul { margin: 0; padding-left: 1.2em; display: grid; gap: 8px; }
        .privacy-doc p { margin: 0; }
      `}</style>
      <main
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '104px clamp(20px, 4vw, 32px) 80px',
        }}
      >
        <p
          style={{
            margin: '0 0 10px',
            fontFamily: 'var(--font-ibm-plex-mono), monospace',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--faint)',
            fontWeight: 600,
          }}
        >
          Canary PropOS
        </p>
        <h1
          style={{
            margin: 0,
            fontWeight: 650,
            fontSize: 'clamp(28px, 4vw, 36px)',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            color: 'var(--text)',
          }}
        >
          Privacy Policy
        </h1>
        <p style={{ margin: '12px 0 0', color: 'var(--dim)', fontSize: 15 }}>
          Last updated {updated}
        </p>

        <article
          className="privacy-doc"
          style={{
            marginTop: 36,
            display: 'grid',
            gap: 28,
            color: 'var(--text)',
          }}
        >
          <Section title="Who we are">
            <p>
              Canary Property Management (“Canary”, “we”) operates the Canary PropOS
              web application at{' '}
              <a href="https://canarypm.ca">canarypm.ca</a>. We manage rental
              properties in St. John&apos;s, Newfoundland and Labrador, and nearby
              communities.
            </p>
            <p>
              Contact:{' '}
              <a href="mailto:info@canarypm.ca">info@canarypm.ca</a> ·{' '}
              <a href="tel:+17092009626">(709) 200-9626</a>
            </p>
          </Section>

          <Section title="What this policy covers">
            <p>
              This policy explains how we handle personal information when you use
              Canary PropOS — including when a property manager connects a Google
              account so the app can read Gmail, Google Drive, or Google Tasks.
            </p>
          </Section>

          <Section title="Information we collect">
            <p>Depending on how you use the app, we may store:</p>
            <ul>
              <li>Account details: name, email, phone, role, and organization.</li>
              <li>
                Property, tenant, owner, lease, payment, and maintenance records
                you or your organization enter.
              </li>
              <li>
                Files you upload (photos, leases, receipts) in our file storage.
              </li>
              <li>
                Technical logs needed to run and secure the service (for example
                sign-in events).
              </li>
            </ul>
          </Section>

          <Section title="Google account connections">
            <p>
              A manager or admin can connect Google from Settings. We only connect
              the Google account they authorize. Tokens stay on our servers and
              are not shown in the browser.
            </p>
            <ul>
              <li>
                <strong>Gmail.</strong> We access mailbox content the connected
                account can read so staff can match Interac e-transfers to rent
                charges and file incoming mail in the organization inbox.
              </li>
              <li>
                <strong>Google Drive.</strong> We list and download files the
                connected account can read so staff can import property photos.
              </li>
              <li>
                <strong>Google Tasks.</strong> We read task lists the connected
                account can access so staff can import incomplete tasks.
              </li>
            </ul>
            <p>
              We do not use Google user data for advertising. We do not sell it.
              We do not use it to train general-purpose AI models. We use it only
              to provide these features to the organization that connected the
              account.
            </p>
            <p>
              Disconnect Gmail, Drive, or Tasks at any time in Settings. That
              deletes the stored Google tokens for that service. You can also
              revoke access in your{' '}
              <a href="https://myaccount.google.com/permissions">
                Google Account permissions
              </a>
              .
            </p>
          </Section>

          <Section title="How we use information">
            <p>We use personal information to:</p>
            <ul>
              <li>operate property management, leasing, and portals</li>
              <li>match payments and communicate with tenants, owners, and vendors</li>
              <li>secure accounts and prevent abuse</li>
              <li>meet legal and accounting obligations</li>
            </ul>
          </Section>

          <Section title="Sharing">
            <p>
              We share information only as needed to run the service: hosting and
              database providers, email delivery, and payment processors. We do
              not sell personal information. We may disclose information if
              required by law.
            </p>
          </Section>

          <Section title="Retention">
            <p>
              We keep organization records for as long as the organization uses
              Canary PropOS and as required for legal, tax, or dispute purposes.
              Google tokens are kept only while that Google service stays
              connected.
            </p>
          </Section>

          <Section title="Security">
            <p>
              Access is limited by signed-in role. Google tokens are stored
              server-side and are not readable by anonymous visitors. No method
              of transmission or storage is completely secure.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              You may request access to, correction of, or deletion of personal
              information we hold about you, subject to legal limits. Email{' '}
              <a href="mailto:info@canarypm.ca">info@canarypm.ca</a>.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We will update this page when our practices change. The “Last
              updated” date at the top is the current version.
            </p>
          </Section>
        </article>

        <p style={{ margin: '48px 0 0', color: 'var(--dim)', fontSize: 14 }}>
          <Link href="/" style={{ color: 'var(--text)', fontWeight: 600 }}>
            Back to Canary
          </Link>
        </p>
      </main>
    </>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section>
      <h2
        style={{
          margin: '0 0 10px',
          fontSize: 18,
          fontWeight: 650,
          letterSpacing: '-0.02em',
          color: 'var(--text)',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: 'grid',
          gap: 12,
          fontSize: 15.5,
          lineHeight: 1.6,
          color: 'var(--text)',
        }}
      >
        {children}
      </div>
    </section>
  )
}
