'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  listIncompleteGoogleTasks,
  refreshTasksTokenIfNeeded,
} from '@/lib/google-tasks'
import type { CanaryOrgTask } from '@/lib/canary/types'

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

async function getCaller() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  const roles = (person.role as unknown as string[]) ?? []
  return { supabase, person, roles }
}

function isStaff(roles: string[]) {
  return roles.some((r) => ['manager', 'admin', 'employee'].includes(r))
}

const statusSchema = z.enum(['todo', 'doing', 'done'])
const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent'])

const createSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  status: statusSchema.default('todo'),
  priority: prioritySchema.default('medium'),
  dueDate: z.string().optional().nullable(),
  assigneePersonId: z.string().uuid().optional().nullable(),
  propertyId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
})

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
})

function mapTaskRow(
  row: {
    id: string
    title: string
    description: string | null
    status: string
    priority: string
    due_date: string | null
    assignee_person_id: string | null
    created_by: string
    property_id: string | null
    project_id: string | null
    visibility: string
    source: string
    google_task_id: string | null
    created_at: string
    updated_at: string
  },
  names: Map<string, string>,
): CanaryOrgTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: (row.status as CanaryOrgTask['status']) || 'todo',
    priority: (row.priority as CanaryOrgTask['priority']) || 'medium',
    dueDate: row.due_date ?? '',
    assigneePersonId: row.assignee_person_id,
    assigneeName: row.assignee_person_id
      ? names.get(row.assignee_person_id) ?? '—'
      : '',
    createdBy: row.created_by,
    createdByName: names.get(row.created_by) ?? '—',
    propertyId: row.property_id,
    property: '',
    projectId: row.project_id,
    visibility: (row.visibility as CanaryOrgTask['visibility']) || 'org',
    source: (row.source as CanaryOrgTask['source']) || 'manual',
    googleTaskId: row.google_task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createOrgTask(input: {
  title: string
  description?: string | null
  status?: 'todo' | 'doing' | 'done'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string | null
  assigneePersonId?: string | null
  propertyId?: string | null
  projectId?: string | null
}): Promise<ActionResult<{ task: CanaryOrgTask }>> {
  const ctx = await getCaller()
  if (!ctx) return { success: false, error: 'You must be signed in.' }
  if (!isStaff(ctx.roles)) {
    return { success: false, error: 'Only staff can create team tasks.' }
  }

  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const d = parsed.data

  const { data, error } = await ctx.supabase
    .from('org_tasks')
    .insert({
      org_id: ctx.person.org_id,
      title: d.title,
      description: d.description || null,
      status: d.status,
      priority: d.priority,
      due_date: d.dueDate || null,
      assignee_person_id: d.assigneePersonId || null,
      created_by: ctx.person.id,
      property_id: d.propertyId || null,
      project_id: d.projectId || null,
      visibility: d.assigneePersonId ? 'assignees' : 'org',
      source: 'manual',
    })
    .select(
      'id, title, description, status, priority, due_date, assignee_person_id, created_by, property_id, project_id, visibility, source, google_task_id, created_at, updated_at',
    )
    .single()

  if (error || !data) {
    console.error('[createOrgTask]', error)
    return { success: false, error: 'Failed to create task.' }
  }

  revalidatePath('/app')
  return {
    success: true,
    data: { task: mapTaskRow(data, new Map()) },
  }
}

export async function updateOrgTask(input: {
  id: string
  title?: string
  description?: string | null
  status?: 'todo' | 'doing' | 'done'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string | null
  assigneePersonId?: string | null
  propertyId?: string | null
  projectId?: string | null
}): Promise<ActionResult<{ task: CanaryOrgTask }>> {
  const ctx = await getCaller()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const d = parsed.data

  const { data: existing } = await ctx.supabase
    .from('org_tasks')
    .select('id, assignee_person_id, created_by')
    .eq('id', d.id)
    .eq('org_id', ctx.person.org_id)
    .maybeSingle()

  if (!existing) return { success: false, error: 'Task not found.' }

  const canManage = isStaff(ctx.roles)
  const isAssignee = existing.assignee_person_id === ctx.person.id
  if (!canManage && !isAssignee) {
    return { success: false, error: 'You cannot edit this task.' }
  }

  type OrgTaskUpdate = {
    title?: string
    description?: string | null
    status?: 'todo' | 'doing' | 'done'
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    due_date?: string | null
    assignee_person_id?: string | null
    visibility?: 'org' | 'assignees'
    property_id?: string | null
    project_id?: string | null
    updated_at: string
  }

  const patch: OrgTaskUpdate = {
    updated_at: new Date().toISOString(),
  }

  if (canManage) {
    if (d.title !== undefined) patch.title = d.title
    if (d.description !== undefined) patch.description = d.description || null
    if (d.status !== undefined) patch.status = d.status
    if (d.priority !== undefined) patch.priority = d.priority
    if (d.dueDate !== undefined) patch.due_date = d.dueDate || null
    if (d.assigneePersonId !== undefined) {
      patch.assignee_person_id = d.assigneePersonId || null
      patch.visibility = d.assigneePersonId ? 'assignees' : 'org'
    }
    if (d.propertyId !== undefined) patch.property_id = d.propertyId || null
    if (d.projectId !== undefined) patch.project_id = d.projectId || null
  } else {
    // Assignees may update status (and optionally priority)
    if (d.status !== undefined) patch.status = d.status
    if (d.priority !== undefined) patch.priority = d.priority
  }

  const { data, error } = await ctx.supabase
    .from('org_tasks')
    .update(patch)
    .eq('id', d.id)
    .eq('org_id', ctx.person.org_id)
    .select(
      'id, title, description, status, priority, due_date, assignee_person_id, created_by, property_id, project_id, visibility, source, google_task_id, created_at, updated_at',
    )
    .single()

  if (error || !data) {
    console.error('[updateOrgTask]', error)
    return { success: false, error: 'Failed to update task.' }
  }

  revalidatePath('/app')
  return { success: true, data: { task: mapTaskRow(data, new Map()) } }
}

export async function deleteOrgTask(taskId: string): Promise<ActionResult> {
  const ctx = await getCaller()
  if (!ctx) return { success: false, error: 'You must be signed in.' }
  if (!isStaff(ctx.roles)) {
    return { success: false, error: 'Only staff can delete team tasks.' }
  }

  const { error } = await ctx.supabase
    .from('org_tasks')
    .delete()
    .eq('id', taskId)
    .eq('org_id', ctx.person.org_id)

  if (error) {
    console.error('[deleteOrgTask]', error)
    return { success: false, error: 'Failed to delete task.' }
  }

  revalidatePath('/app')
  return { success: true }
}

/** Import incomplete Google Tasks into org_tasks (upsert by google_task_id). */
export async function syncGoogleTasks(): Promise<
  ActionResult<{ imported: number; updated: number }>
> {
  const ctx = await getCaller()
  if (!ctx) return { success: false, error: 'You must be signed in.' }
  if (!isStaff(ctx.roles)) {
    return { success: false, error: 'Only managers can sync Google Tasks.' }
  }

  let accessToken: string
  try {
    accessToken = await refreshTasksTokenIfNeeded(ctx.person.org_id, ctx.supabase)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Google Tasks is not connected.'
    return { success: false, error: message }
  }

  let googleTasks: Awaited<ReturnType<typeof listIncompleteGoogleTasks>>
  try {
    googleTasks = await listIncompleteGoogleTasks(accessToken)
  } catch (err) {
    console.error('[syncGoogleTasks] list failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list Google Tasks.',
    }
  }

  let imported = 0
  let updated = 0

  for (const gt of googleTasks) {
    const { data: existing } = await ctx.supabase
      .from('org_tasks')
      .select('id')
      .eq('org_id', ctx.person.org_id)
      .eq('google_task_id', gt.id)
      .maybeSingle()

    if (existing) {
      const { error } = await ctx.supabase
        .from('org_tasks')
        .update({
          title: gt.title,
          description: gt.notes,
          due_date: gt.due,
          updated_at: new Date().toISOString(),
          google_tasklist_id: gt.taskListId,
        })
        .eq('id', existing.id)
      if (!error) updated += 1
    } else {
      const { error } = await ctx.supabase.from('org_tasks').insert({
        org_id: ctx.person.org_id,
        title: gt.title,
        description: gt.notes,
        status: 'todo',
        priority: 'medium',
        due_date: gt.due,
        created_by: ctx.person.id,
        visibility: 'org',
        source: 'google',
        google_task_id: gt.id,
        google_tasklist_id: gt.taskListId,
      })
      if (!error) imported += 1
      else console.error('[syncGoogleTasks] insert', error)
    }
  }

  revalidatePath('/app')
  revalidatePath('/settings')
  return { success: true, data: { imported, updated } }
}
