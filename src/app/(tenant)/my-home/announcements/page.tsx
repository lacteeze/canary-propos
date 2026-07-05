// src/app/(tenant)/my-home/announcements/page.tsx
// Tenant announcements feed — RSC.
// D-11: NEVER select vendor_cost or billed_amount. (No cost fields in this file.)
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

  // 1. Session guard
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Resolve person row
  const { data: person } = await supabase
    .from('people')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  if (!person) redirect('/login')
  if (!person.role.includes('tenant')) redirect('/login')

  // 3. Mark announcements seen (fire-and-forget — do not block render)
  void markAnnouncementsSeen()

  // 4. Derive property_id from active lease (T-06-08: never trust a direct property claim)
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
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <h1 className="mb-4 text-xl font-semibold text-stone-900">Announcements</h1>
        <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center">
          <p className="text-base font-medium text-stone-700">No active lease found.</p>
          <p className="mt-1 text-sm text-stone-500">
            Announcements will appear here once you have an active lease.
          </p>
        </div>
      </div>
    )
  }

  // 5. Fetch non-expired announcements for this property
  //    App-level WHERE mirrors the RLS policy (defence-in-depth).
  //    D-11: no cost fields selected.
  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .eq('property_id', propertyId)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50)

  const list = announcements ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <h1 className="mb-6 text-xl font-semibold text-stone-900">Announcements</h1>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center">
          <p className="text-base font-medium text-stone-700">
            No announcements from your property manager yet.
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Check back here for updates about your building or community.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {list.map((ann) => (
            <div key={ann.id} className="px-5 py-4">
              <p className="mb-1 font-medium text-stone-900">{ann.title}</p>
              <p className="mb-3 whitespace-pre-wrap text-sm text-stone-700">{ann.body}</p>
              <p className="text-xs text-stone-400">Posted {formatDate(ann.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
