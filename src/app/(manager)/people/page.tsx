// src/app/(manager)/people/page.tsx
// Manager people page — Team tab (org members) + Contacts tab (tenants, owners, vendors)
import { createClient } from '@/lib/supabase/server'
import { InviteStatusBadge } from '@/components/people/InviteStatusBadge'
import { RemoveUserDialog } from '@/components/people/RemoveUserDialog'
import { InviteUserForm } from '@/components/people/InviteUserForm'
import { ContactsTab } from '@/components/people/ContactsTab'
import { AddContactForm } from '@/components/people/AddContactForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { redirect } from 'next/navigation'

export default async function PeoplePage() {
  const supabase = await createClient()

  // Verify session
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get caller's person row to resolve org_id
  const { data: callerPerson } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) redirect('/login')

  // Fetch team members in the org (role includes manager/employee — RLS-scoped)
  const { data: people } = await supabase
    .from('people')
    .select('id, email, first_name, last_name, role, invite_accepted_at, active')
    .eq('org_id', callerPerson.org_id)
    .overlaps('role', ['manager', 'employee'])
    .eq('active', true)
    .order('created_at', { ascending: true })

  // Fetch contacts (tenants, owners, vendors) — T-02-08: scoped by org_id
  const { data: contacts } = await supabase
    .from('people')
    .select('id, email, first_name, last_name, role, phone, active')
    .eq('org_id', callerPerson.org_id)
    .overlaps('role', ['tenant', 'owner', 'vendor'])
    .eq('active', true)
    .order('created_at', { ascending: true })

  // Fetch org name for dialog copy
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', callerPerson.org_id)
    .single()

  const orgName = org?.name ?? 'your organization'
  // role is now text[] after migration 0012 — use .includes() not ===
  const isManager =
    callerPerson.role?.includes('manager') || callerPerson.role?.includes('admin')

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">People</h1>
          <p className="mt-1 text-sm text-stone-500">
            Manage your team and contacts.
          </p>
        </div>
      </div>

      <Tabs defaultValue="team">
        <div className="mb-6 flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {isManager && <InviteUserForm orgName={orgName} />}
            {isManager && <AddContactForm />}
          </div>
        </div>

        {/* Team tab */}
        <TabsContent value="team">
          {(!people || people.length === 0) ? (
            /* Empty state */
            <div className="rounded-xl border border-dashed border-stone-200 px-8 py-16 text-center">
              <h2 className="mb-2 text-base font-semibold text-stone-900">
                No team members yet
              </h2>
              <p className="mb-6 text-sm text-stone-500">
                Invite a manager or employee to get started.
              </p>
              {isManager && <InviteUserForm orgName={orgName} buttonLabel="Invite someone" />}
            </div>
          ) : (
            <>
              {/* Desktop table (md+) */}
              <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      {isManager && <th className="px-4 py-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {people.map((person) => (
                      <tr key={person.id} className="bg-white hover:bg-stone-50">
                        <td className="px-4 py-3 font-medium text-stone-900">
                          {person.first_name || person.last_name
                            ? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()
                            : <span className="text-stone-400">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-stone-600">{person.email}</td>
                        <td className="px-4 py-3 capitalize text-stone-600">
                          {Array.isArray(person.role) ? person.role.join(', ') : person.role}
                        </td>
                        <td className="px-4 py-3">
                          <InviteStatusBadge inviteAcceptedAt={person.invite_accepted_at} />
                        </td>
                        {isManager && (
                          <td className="px-4 py-3">
                            {person.email !== user.email && (
                              <RemoveUserDialog
                                personId={person.id}
                                personName={
                                  person.first_name
                                    ? `${person.first_name} ${person.last_name ?? ''}`.trim()
                                    : person.email
                                }
                                orgName={orgName}
                                trigger={
                                  <button className="text-sm text-red-600 hover:text-red-700">
                                    Remove
                                  </button>
                                }
                              />
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {people.map((person) => (
                  <div key={person.id} className="rounded-xl border border-stone-200 bg-white p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className="font-medium text-stone-900">
                          {person.first_name || person.last_name
                            ? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()
                            : person.email
                          }
                        </p>
                        <p className="text-sm text-stone-500">{person.email}</p>
                      </div>
                      <InviteStatusBadge inviteAcceptedAt={person.invite_accepted_at} />
                    </div>
                    <p className="mb-3 text-xs capitalize text-stone-400">
                      {Array.isArray(person.role) ? person.role.join(', ') : person.role}
                    </p>
                    {isManager && person.email !== user.email && (
                      <RemoveUserDialog
                        personId={person.id}
                        personName={
                          person.first_name
                            ? `${person.first_name} ${person.last_name ?? ''}`.trim()
                            : person.email
                        }
                        orgName={orgName}
                        trigger={
                          <button className="text-sm text-red-600 hover:text-red-700">
                            Remove from organization
                          </button>
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Contacts tab */}
        <TabsContent value="contacts">
          <ContactsTab
            contacts={(contacts ?? []).map((c) => ({
              id: c.id,
              first_name: c.first_name,
              last_name: c.last_name,
              email: c.email,
              phone: c.phone ?? null,
              role: Array.isArray(c.role) ? c.role : [c.role].filter(Boolean) as string[],
              active: c.active ?? true,
            }))}
            isManager={!!isManager}
            orgId={callerPerson.org_id}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
