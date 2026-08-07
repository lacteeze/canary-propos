// Tenant announcements feed — RSC.
// D-11: NEVER select vendor_cost or billed_amount.
// T-06-08: property scope derived from active lease; never trusted from input.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { markAnnouncementsSeen } from './actions'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function TenantAnnouncementsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: person } = await supabase
    .from('people')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  if (!person) redirect('/login')
  if (!person.role.includes('tenant')) redirect('/login')

  void markAnnouncementsSeen()

  const { data: leaseRow } = await supabase
    .from('leases')
    .select('id, units!unit_id(property_id)')
    .eq('tenant_id', person.id)
    .eq('status', 'active')
    .limit(1)
    .single()

  const unitData = leaseRow?.units as { property_id: string } | null
  const propertyId = unitData?.property_id ?? null

  if (!propertyId) {
    return (
      <div className="cy-portal-page">
        <h1 className="cy-portal-title">Announcements</h1>
        <div className="cy-portal-empty">
          <p className="cy-portal-empty-title">No active lease found.</p>
          <p className="cy-portal-empty-sub">
            Announcements will appear here once you have an active lease.
          </p>
        </div>
      </div>
    )
  }

  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .eq('property_id', propertyId)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50)

  const list = announcements ?? []

  return (
    <div className="cy-portal-page">
      <h1 className="cy-portal-title">Announcements</h1>

      {list.length === 0 ? (
        <div className="cy-portal-empty">
          <p className="cy-portal-empty-title">
            No announcements from your property manager yet.
          </p>
          <p className="cy-portal-empty-sub">
            Check back here for updates about your building or community.
          </p>
        </div>
      ) : (
        <div className="cy-portal-card" style={{ padding: 0, overflow: 'hidden' }}>
          {list.map((ann, i) => (
            <div
              key={ann.id}
              style={{
                padding: '16px 20px',
                borderTop: i === 0 ? undefined : '1px solid var(--border)',
              }}
            >
              <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text)' }}>{ann.title}</p>
              <p
                className="cy-portal-muted"
                style={{ margin: '0 0 10px', whiteSpace: 'pre-wrap', color: 'var(--text)' }}
              >
                {ann.body}
              </p>
              <p className="cy-portal-muted" style={{ margin: 0, fontSize: 12 }}>
                Posted {formatDate(ann.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
