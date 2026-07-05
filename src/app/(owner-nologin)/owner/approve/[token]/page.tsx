// src/app/(owner-nologin)/owner/approve/[token]/page.tsx
// No-login owner approval page.
// Validates the one-time token, atomically transitions work order to 'assigned',
// and nullifies both owner_approve_token and owner_decline_token.
// Uses admin client — owner has no portal session in Phase 5.
import { createAdminClient } from '@/lib/supabase/admin'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function OwnerApprovePage({ params }: PageProps) {
  const { token } = await params

  if (!token?.trim()) {
    return <InvalidLink />
  }

  const adminSupabase = createAdminClient()

  // Look up work order by approve token and status guard
  const { data: wo } = await adminSupabase
    .from('work_orders')
    .select('id, status, title, estimated_cost, property_id')
    .eq('owner_approve_token', token)
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

  // Atomic update: transition status + nullify both tokens in one operation.
  // The .eq('status', 'pending_approval') guard prevents double-fire (T-05-16).
  const { error: updateError } = await adminSupabase
    .from('work_orders')
    .update({
      status: 'assigned',
      owner_approve_token: null,
      owner_decline_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wo.id)
    .eq('status', 'pending_approval') // race condition guard

  if (updateError) {
    console.error('[OwnerApprovePage] update error:', updateError)
    return (
      <PageShell>
        <StatusCard
          icon="error"
          heading="Something went wrong"
          message="We were unable to process your approval. Please contact Canary Property Management for assistance."
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <StatusCard
        icon="approved"
        heading="Work order approved"
        subheading={`${wo.title} — ${propertyAddress}`}
        message="The contractor will be notified to proceed. Thank you for your prompt response."
      />
    </PageShell>
  )
}

function InvalidLink() {
  return (
    <PageShell>
      <StatusCard
        icon="expired"
        heading="This link has already been used or is no longer valid"
        message="If you have questions, please contact Canary Property Management directly."
      />
    </PageShell>
  )
}

// --- UI components ---

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

function StatusCard({
  icon,
  heading,
  subheading,
  message,
}: {
  icon: 'approved' | 'expired' | 'error'
  heading: string
  subheading?: string
  message: string
}) {
  const iconMap = {
    approved: '✓',
    expired: '○',
    error: '!',
  }
  const colorMap = {
    approved: '#16A34A',
    expired: '#78716C',
    error: '#DC2626',
  }

  return (
    <div>
      <div
        style={{
          ...iconCircleStyle,
          backgroundColor: colorMap[icon],
        }}
      >
        {iconMap[icon]}
      </div>
      <h1 style={headingStyle}>{heading}</h1>
      {subheading && <p style={subheadingStyle}>{subheading}</p>}
      <p style={messageStyle}>{message}</p>
    </div>
  )
}

// --- Inline styles (mobile-first) ---

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
  marginBottom: '32px',
  textTransform: 'uppercase',
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
  margin: '0 0 8px 0',
}

const subheadingStyle: React.CSSProperties = {
  color: '#44403C',
  fontSize: '15px',
  lineHeight: '1.5',
  margin: '0 0 12px 0',
}

const messageStyle: React.CSSProperties = {
  color: '#78716C',
  fontSize: '15px',
  lineHeight: '1.5',
  margin: '0',
}
