// src/app/(owner-nologin)/owner/decline/[token]/page.tsx
// No-login owner decline page.
// Validates the one-time token, shows an optional decline note form,
// then transitions work order to 'closed' with token nullification.
// Uses admin client — owner has no portal session in Phase 5.
import { createAdminClient } from '@/lib/supabase/admin'
import { DeclineForm } from './DeclineForm'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function OwnerDeclinePage({ params }: PageProps) {
  const { token } = await params

  if (!token?.trim()) {
    return <InvalidLink />
  }

  const adminSupabase = createAdminClient()

  // Look up work order by decline token and status guard
  const { data: wo } = await adminSupabase
    .from('work_orders')
    .select('id, status, title, estimated_cost, property_id')
    .eq('owner_decline_token', token)
    .eq('status', 'pending_approval')
    .single()

  if (!wo) {
    return <InvalidLink />
  }

  // Fetch property address for display
  const { data: property } = await adminSupabase
    .from('properties')
    .select('street_address, city, province')
    .eq('id', wo.property_id)
    .single()

  const propertyAddress = property
    ? `${property.street_address}, ${property.city}, ${property.province}`
    : 'your property'

  const formattedCost = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format((wo.estimated_cost as number) ?? 0)

  return (
    <PageShell>
      {/* Work order summary */}
      <p style={summaryStyle}>
        <strong>{wo.title}</strong>
        <br />
        {propertyAddress} &mdash; Est. {formattedCost}
      </p>

      {/* Interactive decline form (client component) */}
      <DeclineForm token={token} />
    </PageShell>
  )
}

function InvalidLink() {
  return (
    <PageShell>
      <div style={{ textAlign: 'center' }}>
        <div style={{ ...iconCircleStyle, backgroundColor: '#78716C' }}>○</div>
        <h1 style={headingStyle}>This link has already been used or is no longer valid</h1>
        <p style={messageStyle}>
          If you have questions, please contact Canary Property Management directly.
        </p>
      </div>
    </PageShell>
  )
}

// --- UI shell ---

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={shellStyle}>
      <div style={cardWrapperStyle}>
        <div style={wordmarkStyle}>Canary PropOS</div>
        {children}
      </div>
    </div>
  )
}

// --- Inline styles ---

const shellStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
  backgroundColor: '#FAFAF9',
}

const cardWrapperStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  maxWidth: '480px',
  width: '100%',
  padding: '40px 32px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
  textAlign: 'center',
}

const wordmarkStyle: React.CSSProperties = {
  color: '#78716C',
  fontSize: '14px',
  fontWeight: '600',
  letterSpacing: '0.05em',
  marginBottom: '24px',
  textTransform: 'uppercase',
}

const summaryStyle: React.CSSProperties = {
  color: '#44403C',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 24px 0',
  padding: '12px 16px',
  backgroundColor: '#F5F5F4',
  borderRadius: '8px',
  textAlign: 'left',
}

const iconCircleStyle: React.CSSProperties = {
  borderRadius: '50%',
  color: '#ffffff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '28px',
  fontWeight: '700',
  height: '64px',
  lineHeight: '1',
  marginBottom: '20px',
  width: '64px',
}

const headingStyle: React.CSSProperties = {
  color: '#1C1917',
  fontSize: '20px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '0 0 12px 0',
}

const messageStyle: React.CSSProperties = {
  color: '#78716C',
  fontSize: '15px',
  lineHeight: '1.5',
  margin: '0',
}
