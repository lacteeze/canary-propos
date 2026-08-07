import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LeaseDownloadButton from './LeaseDownloadButton'

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2)
}

export default async function MyHomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: person } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .single()
  if (!person) redirect('/login')

  const { data: lease } = await supabase
    .from('leases')
    .select(`
      id,
      start_date,
      end_date,
      monthly_rent,
      document_path,
      units!unit_id(
        unit_number,
        properties!property_id( street_address, city, province )
      )
    `)
    .eq('tenant_id', person.id)
    .eq('status', 'active')
    .maybeSingle()

  const unit = lease ? (Array.isArray(lease.units) ? lease.units[0] : lease.units) : null
  const property = unit
    ? Array.isArray(unit.properties)
      ? unit.properties[0]
      : unit.properties
    : null

  return (
    <div className="cy-portal-page" style={{ maxWidth: 560 }}>
      <div className="cy-portal-page-head">
        <div>
          <p className="cy-eyebrow">My home</p>
          <h1 className="cy-portal-title">Lease overview</h1>
        </div>
      </div>

      {!lease ? (
        <div className="cy-portal-empty">
          <p className="cy-portal-empty-title">No active lease found</p>
          <p className="cy-portal-empty-sub">
            Contact your property manager for assistance.
          </p>
        </div>
      ) : (
        <div className="cy-portal-card">
          <h2 className="cy-portal-card-title">Your current lease</h2>

          <dl className="cy-portal-dl">
            <div>
              <dt>Property</dt>
              <dd>
                {property
                  ? `${property.street_address}${unit ? ` — Unit ${unit.unit_number}` : ''}, ${property.city}, ${property.province}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Tenant</dt>
              <dd>
                {person.first_name} {person.last_name}
              </dd>
            </div>
            <div>
              <dt>Term</dt>
              <dd>
                {lease.start_date && lease.end_date
                  ? `${formatDate(lease.start_date)} – ${formatDate(lease.end_date)}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Monthly rent</dt>
              <dd>
                {lease.monthly_rent != null ? formatCurrency(Number(lease.monthly_rent)) : '—'}
              </dd>
            </div>
          </dl>

          <div className="cy-portal-actions">
            <LeaseDownloadButton leaseId={lease.id} hasDocument={!!lease.document_path} />
            <Link href="/my-home/pay" className="cy-btn-primary">
              Pay rent
            </Link>
          </div>

          <div className="cy-portal-links">
            <Link href="/my-home/payments" className="cy-portal-link">
              Payment history
            </Link>
            <Link href="/my-home/maintenance" className="cy-portal-link">
              Maintenance
            </Link>
            <Link href="/my-home/checklist" className="cy-portal-link">
              Move-in checklist
            </Link>
            <Link href="/my-home/announcements" className="cy-portal-link">
              Announcements
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
