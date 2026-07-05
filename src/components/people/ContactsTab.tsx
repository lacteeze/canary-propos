// src/components/people/ContactsTab.tsx
// Contacts tab — shows tenants, owners, vendors with desktop table + mobile cards.
'use client'

import { AddContactForm } from '@/components/people/AddContactForm'
import { EditContactForm } from '@/components/people/EditContactForm'

interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  role: string[]
  active: boolean
}

interface ContactsTabProps {
  contacts: Contact[]
  isManager: boolean
  orgId: string
}

// Role badge styling (UI-SPEC: differentiated colors per role)
function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    tenant: 'bg-stone-100 text-stone-700',
    owner: 'bg-blue-100 text-blue-700',
    vendor: 'bg-purple-100 text-purple-700',
  }
  const cls = styles[role] ?? 'bg-stone-100 text-stone-600'
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {role}
    </span>
  )
}

function contactDisplayName(contact: Contact): string {
  if (contact.first_name || contact.last_name) {
    return `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()
  }
  return contact.email
}

export function ContactsTab({ contacts, isManager, orgId: _orgId }: ContactsTabProps) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 px-8 py-16 text-center">
        <h2 className="mb-2 text-base font-semibold text-stone-900">No contacts yet</h2>
        <p className="mb-6 text-sm text-stone-500">
          Add tenants, owners, and vendors to build your contact directory.
        </p>
        {isManager && <AddContactForm buttonLabel="Add your first contact" />}
      </div>
    )
  }

  return (
    <>
      {/* Desktop table (md+) */}
      <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role(s)</th>
              {isManager && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {contacts.map((contact) => (
              <tr key={contact.id} className="bg-white hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">
                  {contactDisplayName(contact)}
                </td>
                <td className="px-4 py-3 text-stone-600">{contact.email}</td>
                <td className="px-4 py-3 text-stone-600">
                  {contact.phone ?? <span className="text-stone-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {contact.role.map((r) => (
                      <RoleBadge key={r} role={r} />
                    ))}
                  </div>
                </td>
                {isManager && (
                  <td className="px-4 py-3">
                    <EditContactForm contact={contact} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {contacts.map((contact) => (
          <div key={contact.id} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="font-medium text-stone-900">{contactDisplayName(contact)}</p>
                <p className="text-sm text-stone-500">{contact.email}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {contact.role.map((r) => (
                  <RoleBadge key={r} role={r} />
                ))}
              </div>
            </div>
            {contact.phone && (
              <p className="mb-2 text-xs text-stone-400">{contact.phone}</p>
            )}
            {isManager && (
              <EditContactForm contact={contact} />
            )}
          </div>
        ))}
      </div>
    </>
  )
}
