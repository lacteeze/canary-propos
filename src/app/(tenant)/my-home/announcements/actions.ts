'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * createAnnouncement — Manager-only server action.
 * Posts an announcement to a property. org_id is resolved from session (never trusted from input).
 */
export async function createAnnouncement(
  propertyId: string,
  title: string,
  body: string,
  expiresAt: string | null,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) redirect('/login')

  // Auth guard: only managers or employees may post announcements
  if (!person.role.includes('manager') && !person.role.includes('employee')) {
    redirect('/dashboard')
  }

  // Validate inputs
  if (!title.trim()) return { success: false, error: 'Title is required.' }
  if (!body.trim()) return { success: false, error: 'Message body is required.' }

  // Parse optional expiry — date input returns "YYYY-MM-DD"; convert to ISO timestamp
  let expiresAtValue: string | null = null
  if (expiresAt && expiresAt.trim()) {
    const parsed = new Date(`${expiresAt}T23:59:59Z`)
    if (isNaN(parsed.getTime())) {
      return { success: false, error: 'Invalid expiry date.' }
    }
    expiresAtValue = parsed.toISOString()
  }

  const { error } = await supabase.from('announcements').insert({
    property_id: propertyId,
    org_id: person.org_id,
    created_by: person.id,
    title: title.trim(),
    body: body.trim(),
    expires_at: expiresAtValue,
  })

  if (error) {
    console.error('[createAnnouncement] insert error:', error)
    return { success: false, error: 'Failed to post announcement. Please try again.' }
  }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true }
}

/**
 * markAnnouncementsSeen — Tenant fire-and-forget side effect.
 * Updates last_seen_announcements_at on the caller's own people row.
 * No-ops silently if the caller is not a tenant — safe to call from RSC.
 */
export async function markAnnouncementsSeen(): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: person } = await supabase
    .from('people')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return
  if (!person.role.includes('tenant')) return

  // Only update last_seen_announcements_at — no other fields touched (T-06-09)
  await supabase
    .from('people')
    .update({ last_seen_announcements_at: new Date().toISOString() })
    .eq('user_id', user.id)
}
