import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listIntakeSubmissionsForStaff } from '@/app/actions/intake'
import { getCaller } from '@/lib/canary/load-db'
import { formatWhen, INTAKE_STATUS_LABELS } from '@/components/intake/staff-labels'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Client intake | Canary',
}

function isStaff(roles: string[]) {
  return roles.some((r) => ['manager', 'employee', 'admin'].includes(r))
}

export default async function StaffOnboardListPage() {
  const caller = await getCaller()
  if (caller === 'no-user') redirect('/login')
  if (caller === 'no-person') redirect('/onboarding')
  if (!isStaff(caller.roles)) redirect('/app')

  const result = await listIntakeSubmissionsForStaff()

  return (
    <div className="sint-page">
      <header className="sint-bar">
        <h1>Client intake</h1>
        <Link href="/app">Back to app</Link>
      </header>
      <main className="sint-main">
        {!result.success ? (
          <p className="sint-error">{result.error}</p>
        ) : result.submissions.length === 0 ? (
          <p className="sint-empty">No intake submissions yet. Share /onboard with new clients.</p>
        ) : (
          <table className="sint-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Contact</th>
                <th className="sint-desktop-only">Property</th>
                <th>Step</th>
                <th className="sint-desktop-only">Updated</th>
              </tr>
            </thead>
            <tbody>
              {result.submissions.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className={`sint-pill sint-pill--${row.status}`}>
                      {INTAKE_STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td>
                    <Link href={`/app/onboard/${row.id}`}>
                      {row.contact_name || row.contact_email || 'Untitled'}
                    </Link>
                    {row.contact_email ? (
                      <div style={{ color: '#6b6256', fontSize: 13 }}>{row.contact_email}</div>
                    ) : null}
                  </td>
                  <td className="sint-desktop-only">{row.property_address || '—'}</td>
                  <td>{row.current_step} / 7</td>
                  <td className="sint-desktop-only">{formatWhen(row.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
