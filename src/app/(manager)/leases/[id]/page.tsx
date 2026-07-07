// src/app/(manager)/leases/[id]/page.tsx
// Lease detail page — 3 cards: Lease Details, Renewal, Document (LEASE-01 through LEASE-06)
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { LeaseRenewalCard } from '@/components/leases/LeaseRenewalCard'
import { LeaseDocUpload } from '@/components/leases/LeaseDocUpload'
import { LeaseDownloadButton } from '@/components/leases/LeaseDownloadButton'
import { ChecklistSection } from './ChecklistSection'

interface LeaseDetailPageProps {
  params: Promise<{ id: string }>
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function computeDisplayStatus(endDate: string | null, dbStatus: string): 'Active' | 'Expiring' | 'Expired' {
  const today = new Date().toISOString().split('T')[0]
  if (dbStatus === 'expired') return 'Expired'
  if (!endDate) return 'Active'
  if (endDate < today) return 'Expired'
  const daysLeft = Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / 86400000)
  if (daysLeft <= 90) return 'Expiring'
  return 'Active'
}

function statusBadgeClass(status: 'Active' | 'Expiring' | 'Expired'): string {
  if (status === 'Active') return 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700'
  if (status === 'Expiring') return 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700'
  return 'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600'
}

export default async function LeaseDetailPage({ params }: LeaseDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: callerPerson } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) redirect('/login')

  // Fetch lease with full join
  const { data: lease, error } = await supabase
    .from('leases')
    .select(`
      id, start_date, end_date, monthly_rent, deposit_amount, rent_due_day,
      status, renewal_status, proposed_rent, document_path,
      people!tenant_id(id, first_name, last_name, email),
      units!unit_id(id, unit_number, properties!property_id(id, street_address, city))
    `)
    .eq('id', id)
    .eq('org_id', callerPerson.org_id)
    .single()

  if (error || !lease) {
    notFound()
  }

  const tenant = lease.people as { id: string; first_name: string | null; last_name: string | null; email: string } | null
  const unit = lease.units as { id: string; unit_number: string | null; properties: { id: string; street_address: string; city: string } | null } | null

  const tenantName = tenant
    ? [tenant.first_name, tenant.last_name].filter(Boolean).join(' ') || tenant.email
    : 'Unknown Tenant'
  const unitNumber = unit?.unit_number ?? '—'
  const address = unit?.properties
    ? `${unit.properties.street_address}, ${unit.properties.city}`
    : '—'

  const displayStatus = computeDisplayStatus(lease.end_date, lease.status)
  const docFilename = lease.document_path ? lease.document_path.split('/').pop() ?? null : null

  const isManager = callerPerson.role.includes('manager') || callerPerson.role.includes('admin')

  // Fetch checklist for this lease (most recent)
  const { data: checklistRow } = await supabase
    .from('checklists')
    .select('id, title, type, submitted_at, created_at')
    .eq('lease_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let checklistWithItems: {
    id: string
    title: string
    type: string
    submitted_at: string | null
    created_at: string
    items: Array<{
      id: string
      position: number
      label: string
      checked: boolean
      note: string | null
      checked_at: string | null
    }>
  } | null = null

  if (checklistRow) {
    const { data: items } = await supabase
      .from('checklist_items')
      .select('id, position, label, checked, note, checked_at')
      .eq('checklist_id', checklistRow.id)
      .order('position', { ascending: true })

    checklistWithItems = {
      ...checklistRow,
      items: items ?? [],
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/leases"
          className="mb-4 inline-flex items-center text-sm text-stone-500 hover:text-stone-700"
        >
          ← Leases
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">
              Lease: {tenantName} — Unit {unitNumber}, {address}
            </h1>
          </div>
          <span className={statusBadgeClass(displayStatus)}>{displayStatus}</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Card 1: Lease Details */}
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-stone-900">Lease Details</h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">Tenant</dt>
              <dd className="mt-1 text-sm text-stone-800">{tenantName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">Property + Unit</dt>
              <dd className="mt-1 text-sm text-stone-800">{address} — Unit {unitNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">Term</dt>
              <dd className="mt-1 text-sm text-stone-800">{lease.start_date} → {lease.end_date}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">Monthly Rent</dt>
              <dd className="mt-1 text-sm font-medium text-stone-800">
                ${lease.monthly_rent.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">Security Deposit</dt>
              <dd className="mt-1 text-sm text-stone-800">
                ${lease.deposit_amount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">Rent Due</dt>
              <dd className="mt-1 text-sm text-stone-800">
                {ordinalSuffix(lease.rent_due_day)} of each month
              </dd>
            </div>
          </dl>
        </div>

        {/* Card 2: Renewal (D-10 — status flag only) */}
        {isManager && (
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-stone-900">Renewal</h2>
            <p className="mb-4 text-sm text-stone-500">
              Track the renewal conversation status for this lease.
            </p>
            <LeaseRenewalCard
              leaseId={lease.id}
              currentRenewalStatus={lease.renewal_status ?? null}
              currentProposedRent={lease.proposed_rent ?? null}
            />
          </div>
        )}

        {/* Card 3: Checklist */}
        {isManager && (
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-stone-900">Checklist</h2>
            <p className="mb-4 text-sm text-stone-500">
              Create a move-in or move-out acknowledgment checklist for the tenant to sign off on.
            </p>
            <ChecklistSection leaseId={lease.id} existingChecklist={checklistWithItems} />
          </div>
        )}

        {/* Card 4: Lease Document */}
        {isManager && (
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-stone-900">Lease Document</h2>
            {lease.document_path ? (
              <div className="space-y-3">
                <p className="text-sm text-stone-600">
                  File: <span className="font-medium">{docFilename}</span>
                </p>
                <div className="flex items-center gap-3">
                  <LeaseDownloadButton leaseId={lease.id} />
                  <LeaseDocUpload
                    leaseId={lease.id}
                    orgId={callerPerson.org_id}
                    existingDocumentPath={lease.document_path}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-stone-500">No lease document uploaded yet.</p>
                <LeaseDocUpload
                  leaseId={lease.id}
                  orgId={callerPerson.org_id}
                  existingDocumentPath={null}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
