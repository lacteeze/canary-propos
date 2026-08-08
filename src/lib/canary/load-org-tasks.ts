import { createClient } from '@/lib/supabase/server'
import type { CanaryOrgTask, OrgTasksData } from './types'

type OrgTaskRow = {
  id: string
  org_id: string
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
  google_tasklist_id: string | null
  created_at: string
  updated_at: string
}

function mapRow(
  row: OrgTaskRow,
  names: Map<string, string>,
  propertyAddresses: Map<string, string>,
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
    property: row.property_id ? propertyAddresses.get(row.property_id) ?? '' : '',
    projectId: row.project_id,
    visibility: (row.visibility as CanaryOrgTask['visibility']) || 'org',
    source: (row.source as CanaryOrgTask['source']) || 'manual',
    googleTaskId: row.google_task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function loadOrgTasks(
  orgId: string,
  options?: {
    /** When true, only return tasks assigned to this person (vendor portal). */
    assigneeOnlyPersonId?: string
  },
): Promise<OrgTasksData> {
  const supabase = await createClient()

  let query = supabase
    .from('org_tasks')
    .select(
      'id, org_id, title, description, status, priority, due_date, assignee_person_id, created_by, property_id, project_id, visibility, source, google_task_id, google_tasklist_id, created_at, updated_at',
    )
    .eq('org_id', orgId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (options?.assigneeOnlyPersonId) {
    query = query.eq('assignee_person_id', options.assigneeOnlyPersonId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[loadOrgTasks]', error)
    return {
      tasks: [],
      googleTasksConnected: false,
      statusMessage: 'Could not load team tasks.',
      openCount: 0,
    }
  }

  const rows = (data ?? []) as OrgTaskRow[]
  const personIds = new Set<string>()
  const propertyIds = new Set<string>()
  for (const r of rows) {
    if (r.assignee_person_id) personIds.add(r.assignee_person_id)
    if (r.created_by) personIds.add(r.created_by)
    if (r.property_id) propertyIds.add(r.property_id)
  }

  const names = new Map<string, string>()
  if (personIds.size) {
    const { data: people } = await supabase
      .from('people')
      .select('id, first_name, last_name, email')
      .eq('org_id', orgId)
      .in('id', [...personIds])
    for (const p of people ?? []) {
      const label =
        [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
        p.email ||
        '—'
      names.set(p.id, label)
    }
  }

  const propertyAddresses = new Map<string, string>()
  if (propertyIds.size) {
    const { data: props } = await supabase
      .from('properties')
      .select('id, street_address, city')
      .eq('org_id', orgId)
      .in('id', [...propertyIds])
    for (const p of props ?? []) {
      propertyAddresses.set(
        p.id,
        p.city ? `${p.street_address}, ${p.city}` : p.street_address,
      )
    }
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('tasks_connected_at')
    .eq('id', orgId)
    .single()

  const tasks = rows.map((r) => mapRow(r, names, propertyAddresses))
  const openCount = tasks.filter((t) => t.status !== 'done').length

  return {
    tasks,
    googleTasksConnected: Boolean(org?.tasks_connected_at),
    statusMessage:
      tasks.length === 0
        ? 'No team tasks yet — add one or import from Google Tasks.'
        : `${openCount} open · ${tasks.length} total`,
    openCount,
  }
}
