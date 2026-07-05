// src/app/(manager)/dashboard/page.tsx
// Manager dashboard — renders SetupBanner above content when setup is incomplete (D-02)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SetupBanner } from '@/components/onboarding/SetupBanner'
import { SummaryCards } from '@/components/dashboard/SummaryCards'
import { ExpiryAlertCallout } from '@/components/leases/ExpiryAlertCallout'
import { MessageSquare } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get caller's org to check setup status (D-02)
  const { data: person } = await supabase
    .from('people')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  let setupCompleted = true
  if (person?.org_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('setup_completed_at')
      .eq('id', person.org_id)
      .single()
    setupCompleted = !!org?.setup_completed_at
  }

  const orgId = person?.org_id

  // Aggregate counts — all scoped by org_id (T-02-17)
  const [
    { count: totalUnits },
    { count: occupiedUnits },
    { count: vacantUnits },
    { count: activeLeases },
    { count: newInquiryCount },
  ] = await Promise.all([
    supabase.from('units').select('*', { count: 'exact', head: true }).eq('org_id', orgId ?? ''),
    supabase
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId ?? '')
      .eq('status', 'occupied'),
    supabase
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId ?? '')
      .eq('status', 'vacant'),
    supabase
      .from('leases')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId ?? '')
      .eq('status', 'active'),
    supabase
      .from('inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId ?? '')
      .eq('status', 'new'),
  ])

  // Expiring leases within 90 days (LEASE-03, T-02-18)
  const ninetyDaysFromNow = new Date()
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)

  type ExpiringLeaseRow = {
    id: string
    end_date: string
    people: { first_name: string; last_name: string } | null
    units: {
      unit_number: string
      properties: { street_address: string; city: string } | null
    } | null
  }

  const { data: rawExpiring } = await supabase
    .from('leases')
    .select(
      `id, end_date,
       people!tenant_id(first_name, last_name),
       units!unit_id(unit_number, properties!property_id(street_address, city))`
    )
    .eq('org_id', orgId ?? '')
    .eq('status', 'active')
    .lte('end_date', ninetyDaysFromNow.toISOString().split('T')[0])
    .order('end_date', { ascending: true })
    .returns<ExpiringLeaseRow[]>()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiringLeases = (rawExpiring ?? []).map((lease) => {
    const endDate = new Date(lease.end_date)
    const diffMs = endDate.getTime() - today.getTime()
    const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    const tenantName = lease.people
      ? `${lease.people.first_name} ${lease.people.last_name}`
      : 'Unknown Tenant'

    const unitNumber = lease.units?.unit_number ?? ''
    const city = lease.units?.properties?.city ?? ''
    const propertyUnit = city && unitNumber ? `${city} — Unit ${unitNumber}` : unitNumber || city || ''

    return {
      id: lease.id,
      tenantName,
      propertyUnit,
      endDate: lease.end_date,
      daysUntilExpiry,
    }
  })

  return (
    <div className="px-4 py-8 md:px-8">
      {/* SetupBanner renders above main content when setup_completed_at is null (D-02) */}
      <SetupBanner setupComplete={setupCompleted} />

      <h1 className="mb-6 text-xl font-semibold text-stone-900">Dashboard</h1>

      <div className="space-y-8">
        {/* Summary cards — 2×2 mobile, 4-col desktop */}
        <SummaryCards
          totalUnits={totalUnits ?? 0}
          occupiedUnits={occupiedUnits ?? 0}
          vacantUnits={vacantUnits ?? 0}
          activeLeases={activeLeases ?? 0}
        />

        {/* New inquiries callout card (D-12, LIST-07) */}
        <Link
          href="/inquiries"
          className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
            (newInquiryCount ?? 0) > 0
              ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
              : 'border-stone-200 bg-white hover:bg-stone-50'
          }`}
        >
          <MessageSquare
            className={`h-6 w-6 shrink-0 ${(newInquiryCount ?? 0) > 0 ? 'text-amber-600' : 'text-stone-400'}`}
          />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${(newInquiryCount ?? 0) > 0 ? 'text-amber-900' : 'text-stone-700'}`}>
              {(newInquiryCount ?? 0) > 0
                ? `${newInquiryCount} new ${newInquiryCount === 1 ? 'inquiry' : 'inquiries'} awaiting review`
                : 'No new inquiries'}
            </p>
            <p className="text-xs text-stone-500">View all inquiries and applications →</p>
          </div>
        </Link>

        {/* Lease expiry alerts (LEASE-03) — only renders if leases expiring within 90 days */}
        {expiringLeases.length > 0 && (
          <ExpiryAlertCallout leases={expiringLeases} />
        )}
      </div>
    </div>
  )
}
