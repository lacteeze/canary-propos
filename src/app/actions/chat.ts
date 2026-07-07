'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

type ActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string }

export type ChatThread = {
  id: string
  type: 'property' | 'direct'
  title: string
  propertyId: string | null
  lastMessageAt: string
  lastMessagePreview: string | null
  otherPersonName: string | null
}

export type ChatMessage = {
  id: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
  isOwn: boolean
}

async function getStaffContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role, first_name, last_name, email')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  const roles = (person.role as unknown as string[]) ?? []
  if (!roles.includes('manager') && !roles.includes('employee') && !roles.includes('admin')) return null
  return { supabase, person }
}

function personName(p: { first_name: string | null; last_name: string | null; email: string } | null): string {
  if (!p) return 'Unknown'
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
}

export async function listChatThreads(): Promise<ChatThread[]> {
  const ctx = await getStaffContext()
  if (!ctx) return []

  const { data: threads } = await ctx.supabase
    .from('chat_threads')
    .select(`
      id, type, property_id, title, last_message_at,
      properties!property_id(street_address, city),
      chat_messages(body, created_at)
    `)
    .eq('org_id', ctx.person.org_id)
    .order('last_message_at', { ascending: false })
    .limit(100)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const results: ChatThread[] = []

  for (const t of (threads ?? []) as any[]) {
    const msgs = (t.chat_messages ?? []) as { body: string; created_at: string }[]
    msgs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    const lastMsg = msgs[0]

    let title = t.title ?? 'Chat'
    let otherPersonName: string | null = null

    if (t.type === 'property' && t.properties) {
      const p = t.properties
      title = p.city ? `${p.street_address}, ${p.city}` : p.street_address
    }

    if (t.type === 'direct') {
      const { data: members } = await ctx.supabase
        .from('chat_thread_members')
        .select('person_id, people!person_id(first_name, last_name, email)')
        .eq('thread_id', t.id)

      const others = (members ?? [])
        .filter((m: any) => m.person_id !== ctx.person.id)
        .map((m: any) => personName(m.people))
      otherPersonName = others[0] ?? null
      title = otherPersonName ?? 'Direct message'
    }

    results.push({
      id: t.id,
      type: t.type,
      title,
      propertyId: t.property_id,
      lastMessageAt: t.last_message_at,
      lastMessagePreview: lastMsg?.body?.slice(0, 80) ?? null,
      otherPersonName,
    })
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return results
}

export async function getThreadMessages(threadId: string): Promise<ChatMessage[]> {
  const ctx = await getStaffContext()
  if (!ctx) return []

  const { data } = await ctx.supabase
    .from('chat_messages')
    .select('id, author_id, body, created_at, people!author_id(first_name, last_name, email)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(200)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((m: any) => ({
    id: m.id,
    authorId: m.author_id,
    authorName: personName(m.people),
    body: m.body,
    createdAt: m.created_at,
    isOwn: m.author_id === ctx.person.id,
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

const messageSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().min(1).max(10000),
})

export async function sendChatMessage(threadId: string, body: string): Promise<ActionResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  const parsed = messageSchema.safeParse({ threadId, body: body.trim() })
  if (!parsed.success) return { success: false, error: 'Invalid message.' }

  const now = new Date().toISOString()
  const { error: msgErr } = await ctx.supabase.from('chat_messages').insert({
    thread_id: threadId,
    author_id: ctx.person.id,
    body: parsed.data.body,
  })
  if (msgErr) {
    console.error('[sendChatMessage]', msgErr)
    return { success: false, error: 'Failed to send message.' }
  }

  await ctx.supabase
    .from('chat_threads')
    .update({ last_message_at: now })
    .eq('id', threadId)
    .eq('org_id', ctx.person.org_id)

  revalidatePath('/app')
  return { success: true }
}

export async function getOrCreatePropertyThread(propertyId: string): Promise<ActionResult<{ threadId: string }>> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  const { data: existing } = await ctx.supabase
    .from('chat_threads')
    .select('id')
    .eq('org_id', ctx.person.org_id)
    .eq('type', 'property')
    .eq('property_id', propertyId)
    .maybeSingle()

  if (existing) return { success: true, data: { threadId: existing.id } }

  const { data: prop } = await ctx.supabase
    .from('properties')
    .select('street_address, city')
    .eq('id', propertyId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!prop) return { success: false, error: 'Property not found.' }

  const title = prop.city ? `${prop.street_address}, ${prop.city}` : prop.street_address

  const { data: created, error } = await ctx.supabase
    .from('chat_threads')
    .insert({
      org_id: ctx.person.org_id,
      type: 'property',
      property_id: propertyId,
      title,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[getOrCreatePropertyThread]', error)
    return { success: false, error: 'Failed to create property chat.' }
  }

  revalidatePath('/app')
  return { success: true, data: { threadId: created.id } }
}

export async function getOrCreateDirectThread(otherPersonId: string): Promise<ActionResult<{ threadId: string }>> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Not authorized.' }

  if (otherPersonId === ctx.person.id) {
    return { success: false, error: 'Cannot message yourself.' }
  }

  const { data: other } = await ctx.supabase
    .from('people')
    .select('id')
    .eq('id', otherPersonId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!other) return { success: false, error: 'Person not found.' }

  const { data: myThreads } = await ctx.supabase
    .from('chat_thread_members')
    .select('thread_id')
    .eq('person_id', ctx.person.id)

  const threadIds = (myThreads ?? []).map((t) => t.thread_id)
  if (threadIds.length) {
    for (const tid of threadIds) {
      const { data: thread } = await ctx.supabase
        .from('chat_threads')
        .select('id, type')
        .eq('id', tid)
        .eq('type', 'direct')
        .maybeSingle()
      if (!thread) continue

      const { data: members } = await ctx.supabase
        .from('chat_thread_members')
        .select('person_id')
        .eq('thread_id', tid)

      const ids = (members ?? []).map((m) => m.person_id).sort()
      const expected = [ctx.person.id, otherPersonId].sort()
      if (ids.length === 2 && ids[0] === expected[0] && ids[1] === expected[1]) {
        return { success: true, data: { threadId: tid } }
      }
    }
  }

  const { data: otherPerson } = await ctx.supabase
    .from('people')
    .select('first_name, last_name, email')
    .eq('id', otherPersonId)
    .single()

  const { data: created, error } = await ctx.supabase
    .from('chat_threads')
    .insert({
      org_id: ctx.person.org_id,
      type: 'direct',
      title: personName(otherPerson),
    })
    .select('id')
    .single()

  if (error || !created) {
    console.error('[getOrCreateDirectThread]', error)
    return { success: false, error: 'Failed to create direct message thread.' }
  }

  await ctx.supabase.from('chat_thread_members').insert([
    { thread_id: created.id, person_id: ctx.person.id },
    { thread_id: created.id, person_id: otherPersonId },
  ])

  revalidatePath('/app')
  return { success: true, data: { threadId: created.id } }
}

export async function listStaffForDm(): Promise<{ id: string; name: string }[]> {
  const ctx = await getStaffContext()
  if (!ctx) return []

  const { data } = await ctx.supabase
    .from('people')
    .select('id, first_name, last_name, email, role')
    .eq('org_id', ctx.person.org_id)
    .eq('active', true)
    .neq('id', ctx.person.id)

  return (data ?? [])
    .filter((p) => {
      const roles = (p.role as unknown as string[]) ?? []
      return roles.some((r) => ['manager', 'admin', 'employee'].includes(r))
    })
    .map((p) => ({
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
