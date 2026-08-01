'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  getDriveFileMetadata,
  listDriveChildren,
  refreshDriveTokenIfNeeded,
} from '@/lib/google-drive'
import type { DriveListItem } from '@/lib/google-drive-types'
import {
  importDriveFileToProperty,
  syncPropertyDriveFolder,
  type DriveSyncStats,
} from '@/lib/drive-photo-sync'

export type ActionResult =
  | { success: true }
  | { success: false; error: string }

async function getCallerContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  return { supabase, user, person }
}

function isManager(roles: string[] | null | undefined) {
  return !!roles?.includes('manager') || !!roles?.includes('admin')
}

export async function getDriveConnectionStatus(): Promise<
  | { success: true; connected: boolean; connectedAt: string | null }
  | { success: false; error: string }
> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('drive_connected_at')
    .eq('id', ctx.person.org_id)
    .single()

  return {
    success: true,
    connected: Boolean(org?.drive_connected_at),
    connectedAt: org?.drive_connected_at ?? null,
  }
}

export async function listDriveFolderItems(
  folderId?: string | null,
): Promise<
  | { success: true; items: DriveListItem[]; folderId: string }
  | { success: false; error: string }
> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }
  if (!isManager(ctx.person.role as unknown as string[])) {
    return { success: false, error: 'Only managers can browse Google Drive.' }
  }

  try {
    const accessToken = await refreshDriveTokenIfNeeded(
      ctx.person.org_id,
      ctx.supabase,
    )
    const parent = folderId && folderId.length > 0 ? folderId : 'root'
    const items = await listDriveChildren(accessToken, parent)
    return { success: true, items, folderId: parent }
  } catch (err) {
    console.error('[listDriveFolderItems]', err)
    const message =
      err instanceof Error ? err.message : 'Failed to list Drive folder.'
    return { success: false, error: message }
  }
}

const importSchema = z.object({
  propertyId: z.string().uuid(),
  fileIds: z.array(z.string().min(1)).min(1).max(50),
  visibility: z.enum(['listing', 'private']),
  replaceExisting: z.boolean().optional(),
})

export async function importDriveFilesToProperty(input: {
  propertyId: string
  fileIds: string[]
  visibility: 'listing' | 'private'
  replaceExisting?: boolean
}): Promise<
  ActionResult & {
    imported?: number
    replaced?: number
    skipped?: number
    errors?: string[]
  }
> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }
  if (!isManager(ctx.person.role as unknown as string[])) {
    return { success: false, error: 'Only managers can import Drive photos.' }
  }

  const parsed = importSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { data: property, error: propError } = await ctx.supabase
    .from('properties')
    .select('id')
    .eq('id', parsed.data.propertyId)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (propError || !property) {
    return { success: false, error: 'Property not found.' }
  }

  let accessToken: string
  try {
    accessToken = await refreshDriveTokenIfNeeded(ctx.person.org_id, ctx.supabase)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Google Drive is not connected.'
    return { success: false, error: message }
  }

  let imported = 0
  let replaced = 0
  let skipped = 0
  const errors: string[] = []
  const replaceIfExists = parsed.data.replaceExisting ?? true

  for (const fileId of parsed.data.fileIds) {
    try {
      const meta = await getDriveFileMetadata(accessToken, fileId)
      if (!meta || meta.isFolder) {
        errors.push(`${fileId}: not an image file`)
        continue
      }

      const result = await importDriveFileToProperty({
        supabase: ctx.supabase,
        orgId: ctx.person.org_id,
        propertyId: parsed.data.propertyId,
        accessToken,
        driveFile: meta,
        visibility: parsed.data.visibility,
        replaceIfExists,
      })

      if (result === 'imported') imported += 1
      else if (result === 'replaced') replaced += 1
      else skipped += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      errors.push(`${fileId}: ${message}`)
      console.error('[importDriveFilesToProperty]', fileId, err)
    }
  }

  revalidatePath('/properties/' + parsed.data.propertyId)
  revalidatePath('/app')

  if (imported === 0 && replaced === 0 && errors.length > 0 && skipped === 0) {
    return { success: false, error: errors[0], imported, replaced, skipped, errors }
  }

  return { success: true, imported, replaced, skipped, errors }
}

export async function getPropertyDriveLink(propertyId: string): Promise<
  | {
      success: true
      folderId: string | null
      folderName: string | null
      lastSyncedAt: string | null
      driveConnected: boolean
    }
  | { success: false; error: string }
> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  const id = z.string().uuid().safeParse(propertyId)
  if (!id.success) return { success: false, error: 'Invalid property.' }

  const [{ data: property }, { data: org }] = await Promise.all([
    ctx.supabase
      .from('properties')
      .select('drive_folder_id, drive_folder_name, drive_last_synced_at')
      .eq('id', id.data)
      .eq('org_id', ctx.person.org_id)
      .single(),
    ctx.supabase
      .from('organizations')
      .select('drive_connected_at')
      .eq('id', ctx.person.org_id)
      .single(),
  ])

  if (!property) return { success: false, error: 'Property not found.' }

  return {
    success: true,
    folderId: property.drive_folder_id,
    folderName: property.drive_folder_name,
    lastSyncedAt: property.drive_last_synced_at,
    driveConnected: Boolean(org?.drive_connected_at),
  }
}

const linkSchema = z.object({
  propertyId: z.string().uuid(),
  folderId: z.string().min(1),
  folderName: z.string().min(1).max(240),
})

export async function linkPropertyDriveFolder(input: {
  propertyId: string
  folderId: string
  folderName: string
}): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }
  if (!isManager(ctx.person.role as unknown as string[])) {
    return { success: false, error: 'Only managers can link a Drive folder.' }
  }

  const parsed = linkSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { error } = await ctx.supabase
    .from('properties')
    .update({
      drive_folder_id: parsed.data.folderId,
      drive_folder_name: parsed.data.folderName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.propertyId)
    .eq('org_id', ctx.person.org_id)

  if (error) {
    console.error('[linkPropertyDriveFolder]', error)
    return { success: false, error: 'Failed to link Drive folder.' }
  }

  revalidatePath('/properties/' + parsed.data.propertyId)
  revalidatePath('/app')
  return { success: true }
}

export async function unlinkPropertyDriveFolder(
  propertyId: string,
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }
  if (!isManager(ctx.person.role as unknown as string[])) {
    return { success: false, error: 'Only managers can unlink a Drive folder.' }
  }

  const id = z.string().uuid().safeParse(propertyId)
  if (!id.success) return { success: false, error: 'Invalid property.' }

  const { error } = await ctx.supabase
    .from('properties')
    .update({
      drive_folder_id: null,
      drive_folder_name: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id.data)
    .eq('org_id', ctx.person.org_id)

  if (error) {
    console.error('[unlinkPropertyDriveFolder]', error)
    return { success: false, error: 'Failed to unlink Drive folder.' }
  }

  revalidatePath('/properties/' + id.data)
  revalidatePath('/app')
  return { success: true }
}

export async function syncPropertyDrivePhotos(
  propertyId: string,
): Promise<ActionResult & { stats?: DriveSyncStats }> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }
  if (!isManager(ctx.person.role as unknown as string[])) {
    return { success: false, error: 'Only managers can sync Drive photos.' }
  }

  const id = z.string().uuid().safeParse(propertyId)
  if (!id.success) return { success: false, error: 'Invalid property.' }

  const { data: property } = await ctx.supabase
    .from('properties')
    .select('id, drive_folder_id')
    .eq('id', id.data)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (!property?.drive_folder_id) {
    return { success: false, error: 'No Drive folder linked to this property.' }
  }

  try {
    const stats = await syncPropertyDriveFolder({
      supabase: ctx.supabase,
      orgId: ctx.person.org_id,
      propertyId: id.data,
      folderId: property.drive_folder_id,
    })

    revalidatePath('/properties/' + id.data)
    revalidatePath('/app')
    revalidatePath('/')
    revalidatePath('/listings')

    return { success: true, stats }
  } catch (err) {
    console.error('[syncPropertyDrivePhotos]', err)
    const message = err instanceof Error ? err.message : 'Sync failed.'
    return { success: false, error: message }
  }
}
