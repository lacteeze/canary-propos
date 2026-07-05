// src/app/(manager)/inquiries/page.tsx
// Manager inquiries list page — shows all inquiries/applications for the org (LIST-07, D-12)
// RSC: data fetched server-side, status updates via Server Action
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { updateInquiryStatus } from '@/app/actions/inquiries'

// --- Types for the joined query result ---
type InquiryWithListing = {
  id: string
  name: string
  email: string
  phone: string | null
  type: 'inquiry' | 'application'
  status: 'new' | 'contacted' | 'closed'
  created_at: string
  move_in_date: string | null
  budget: number | null
  note: string | null
  listings: {
    id: string
    listing_title: string
    units: {
      properties: {
        street_address: string
        city: string
      } | null
    } | null
  } | null
}

// --- Badge helpers ---
function TypeBadge({ type }: { type: 'inquiry' | 'application' }) {
  if (type === 'application') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Application
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
      Showing Request
    </span>
  )
}

function StatusBadge({ status }: { status: 'new' | 'contacted' | 'closed' }) {
  if (status === 'new') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        New
      </span>
    )
  }
  if (status === 'contacted') {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        Contacted
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
      Closed
    </span>
  )
}

// --- Status update buttons (inline form with bound server action) ---
function StatusButtons({ inquiry }: { inquiry: InquiryWithListing }) {
  const statuses: Array<{ value: 'new' | 'contacted' | 'closed'; label: string }> = [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'closed', label: 'Closed' },
  ]

  return (
    <div className="flex gap-1 flex-wrap">
      {statuses.map(({ value, label }) => {
        const isCurrent = inquiry.status === value
        const boundAction = updateInquiryStatus.bind(null, inquiry.id, value)
        const action = async (_formData: FormData) => { await boundAction() }
        return (
          <form key={value} action={action}>
            <button
              type="submit"
              disabled={isCurrent}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                isCurrent
                  ? 'bg-stone-200 text-stone-500 cursor-default'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 hover:border-stone-300'
              }`}
            >
              {label}
            </button>
          </form>
        )
      })}
    </div>
  )
}

export default async function InquiriesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: callerPerson } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) redirect('/login')
  if (!callerPerson.role?.includes('manager') && !callerPerson.role?.includes('admin')) {
    redirect('/dashboard')
  }

  // Fetch inquiries with listing + property join (T-03-18: org_id filter)
  const { data: rawInquiries } = await supabase
    .from('inquiries')
    .select(
      `id, name, email, phone, type, status, created_at, move_in_date, budget, note,
       listings!listing_id(id, listing_title, units!unit_id(properties!property_id(street_address, city)))`
    )
    .eq('org_id', callerPerson.org_id)
    .order('created_at', { ascending: false })

  const inquiries = (rawInquiries ?? []) as unknown as InquiryWithListing[]

  // Format date for display
  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  function getListingDisplay(inquiry: InquiryWithListing) {
    const listing = inquiry.listings
    if (!listing) return { title: '—', address: '' }
    const property = listing.units?.properties
    return {
      title: listing.listing_title,
      address: property ? `${property.street_address}, ${property.city}` : '',
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      {/* Back link */}
      <div className="mb-4">
        <Link href="/dashboard" className="text-sm text-stone-500 hover:text-stone-700">
          ← Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-stone-900">Inquiries</h1>
        <p className="mt-1 text-sm text-stone-500">
          {inquiries.length === 0
            ? 'No inquiries yet.'
            : `${inquiries.length} total ${inquiries.length === 1 ? 'inquiry' : 'inquiries'}`}
        </p>
      </div>

      {/* Empty state */}
      {inquiries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 px-8 py-16 text-center">
          <p className="text-base font-medium text-stone-700">No inquiries yet</p>
          <p className="mt-2 text-sm text-stone-500">
            Once visitors submit inquiries from your listings page, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {inquiries.map((inquiry) => {
                  const { title, address } = getListingDisplay(inquiry)
                  return (
                    <tr key={inquiry.id} className="bg-white hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-900">
                        <div>{inquiry.name}</div>
                        {inquiry.phone && (
                          <div className="text-xs text-stone-400">{inquiry.phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-600">{inquiry.email}</td>
                      <td className="px-4 py-3">
                        <TypeBadge type={inquiry.type} />
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        <div className="font-medium">{title}</div>
                        {address && <div className="text-xs text-stone-400">{address}</div>}
                      </td>
                      <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                        {formatDate(inquiry.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inquiry.status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusButtons inquiry={inquiry} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {inquiries.map((inquiry) => {
              const { title, address } = getListingDisplay(inquiry)
              return (
                <div key={inquiry.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-stone-900">{inquiry.name}</p>
                      <p className="text-sm text-stone-500">{inquiry.email}</p>
                      {inquiry.phone && (
                        <p className="text-sm text-stone-500">{inquiry.phone}</p>
                      )}
                    </div>
                    <TypeBadge type={inquiry.type} />
                  </div>
                  <div className="mb-3 space-y-1 text-sm text-stone-600">
                    <p className="font-medium">{title}</p>
                    {address && <p className="text-xs text-stone-400">{address}</p>}
                    <p className="text-xs text-stone-400">{formatDate(inquiry.created_at)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={inquiry.status} />
                    <StatusButtons inquiry={inquiry} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
