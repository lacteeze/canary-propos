// src/lib/drive-photo-sync.ts
// Shared Drive → org-assets import/replace helpers for browse + linked-folder sync.
// SERVER ONLY.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  downloadDriveFile,
  extensionForMime,
  listDriveImagesInFolder,
  refreshDriveTokenIfNeeded,
} from '@/lib/google-drive'
import type { DriveListItem } from '@/lib/google-drive-types'

export type DriveSyncStats = {
  imported: number
  replaced: number
  skipped: number
  missingOnDrive: number
  /** Images discovered on Drive (after mime/shortcut/recursive filters). */
  foundOnDrive: number
  errors: string[]
}

async function syncLegacyPhotoPaths(
  supabase: SupabaseClient,
  propertyId: string,
  orgId: string,
) {
  const { data: listingRows } = await supabase
    .from('property_media')
    .select('storage_path, sort_order')
    .eq('property_id', propertyId)
    .eq('org_id', orgId)
    .eq('visibility', 'listing')
    .order('sort_order', { ascending: true })

  const photoPaths = (listingRows ?? []).map((row) => row.storage_path)

  await supabase
    .from('properties')
    .update({ photo_paths: photoPaths, updated_at: new Date().toISOString() })
    .eq('id', propertyId)
    .eq('org_id', orgId)
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_')
}

async function nextSortOrder(
  supabase: SupabaseClient,
  propertyId: string,
  visibility: 'listing' | 'private',
): Promise<number> {
  const { data: existing } = await supabase
    .from('property_media')
    .select('sort_order')
    .eq('property_id', propertyId)
    .eq('visibility', visibility)
    .order('sort_order', { ascending: false })
    .limit(1)

  return (existing?.[0]?.sort_order ?? -1) + 1
}

/**
 * Download a Drive file and upload into org-assets, then insert/replace property_media.
 * When replaceIfExists is true and the same drive_file_id is already linked, replaces storage.
 */
export async function importDriveFileToProperty(opts: {
  supabase: SupabaseClient
  orgId: string
  propertyId: string
  accessToken: string
  driveFile: DriveListItem
  visibility: 'listing' | 'private'
  /** When true, replace existing media with the same drive_file_id. When false, skip. */
  replaceIfExists: boolean
  /** Sync-only: skip replace when Drive modifiedTime is not newer than media.updated_at */
  onlyIfNewer?: boolean
}): Promise<'imported' | 'replaced' | 'skipped'> {
  const {
    supabase,
    orgId,
    propertyId,
    accessToken,
    driveFile,
    visibility,
    replaceIfExists,
    onlyIfNewer = false,
  } = opts

  const { data: existing } = await supabase
    .from('property_media')
    .select('id, storage_path, updated_at')
    .eq('org_id', orgId)
    .eq('drive_file_id', driveFile.id)
    .maybeSingle()

  if (existing && !replaceIfExists) {
    return 'skipped'
  }

  // Change detection for sync: skip if Drive modifiedTime is not newer than media.updated_at
  if (
    existing &&
    replaceIfExists &&
    onlyIfNewer &&
    driveFile.modifiedTime &&
    existing.updated_at
  ) {
    const driveMod = Date.parse(driveFile.modifiedTime)
    const mediaUpdated = Date.parse(existing.updated_at)
    if (!Number.isNaN(driveMod) && !Number.isNaN(mediaUpdated) && driveMod <= mediaUpdated) {
      return 'skipped'
    }
  }

  const { buffer, mimeType, name } = await downloadDriveFile(accessToken, driveFile.id)
  const ext = extensionForMime(mimeType)
  const baseName = safeFileName(name.includes('.') ? name : `${name}.${ext}`)
  const folder = visibility === 'listing' ? 'photos' : 'private-photos'
  const path = `${orgId}/properties/${propertyId}/${folder}/${Date.now()}-${baseName}`

  const { error: uploadError } = await supabase.storage
    .from('org-assets')
    .upload(path, buffer, { upsert: false, contentType: mimeType })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  if (existing) {
    const oldPath = existing.storage_path
    const { error: updateError } = await supabase
      .from('property_media')
      .update({
        storage_path: path,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('org_id', orgId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    if (oldPath && oldPath !== path) {
      await supabase.storage.from('org-assets').remove([oldPath])
    }

    if (visibility === 'listing') {
      await syncLegacyPhotoPaths(supabase, propertyId, orgId)
    }

    return 'replaced'
  }

  const sortOrder = await nextSortOrder(supabase, propertyId, visibility)
  const { error: insertError } = await supabase.from('property_media').insert({
    org_id: orgId,
    property_id: propertyId,
    storage_path: path,
    visibility,
    sort_order: sortOrder,
    drive_file_id: driveFile.id,
  })

  if (insertError) {
    throw new Error(insertError.message)
  }

  if (visibility === 'listing') {
    await syncLegacyPhotoPaths(supabase, propertyId, orgId)
  }

  return 'imported'
}

export async function syncPropertyDriveFolder(opts: {
  supabase: SupabaseClient
  orgId: string
  propertyId: string
  folderId: string
}): Promise<DriveSyncStats> {
  const { supabase, orgId, propertyId, folderId } = opts
  const stats: DriveSyncStats = {
    imported: 0,
    replaced: 0,
    skipped: 0,
    missingOnDrive: 0,
    foundOnDrive: 0,
    errors: [],
  }

  const accessToken = await refreshDriveTokenIfNeeded(orgId, supabase)
  const driveImages = await listDriveImagesInFolder(accessToken, folderId)
  stats.foundOnDrive = driveImages.length
  const driveIds = new Set(driveImages.map((f) => f.id))

  const { data: linkedMedia } = await supabase
    .from('property_media')
    .select('id, drive_file_id')
    .eq('org_id', orgId)
    .eq('property_id', propertyId)
    .not('drive_file_id', 'is', null)

  for (const row of linkedMedia ?? []) {
    if (row.drive_file_id && !driveIds.has(row.drive_file_id)) {
      stats.missingOnDrive += 1
    }
  }

  for (const file of driveImages) {
    try {
      const result = await importDriveFileToProperty({
        supabase,
        orgId,
        propertyId,
        accessToken,
        driveFile: file,
        visibility: 'listing',
        replaceIfExists: true,
        onlyIfNewer: true,
      })
      if (result === 'imported') stats.imported += 1
      else if (result === 'replaced') stats.replaced += 1
      else stats.skipped += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      stats.errors.push(`${file.name}: ${message}`)
    }
  }

  await supabase
    .from('properties')
    .update({
      drive_last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', propertyId)
    .eq('org_id', orgId)

  return stats
}

/** Cron/admin helper: sync all properties with a linked Drive folder. */
export async function syncAllLinkedDriveFolders(): Promise<{
  properties: number
  stats: DriveSyncStats
  errors: string[]
}> {
  const admin = createAdminClient()
  const aggregate: DriveSyncStats = {
    imported: 0,
    replaced: 0,
    skipped: 0,
    missingOnDrive: 0,
    foundOnDrive: 0,
    errors: [],
  }
  const errors: string[] = []

  const { data: properties, error } = await admin
    .from('properties')
    .select('id, org_id, drive_folder_id, street_address')
    .not('drive_folder_id', 'is', null)

  if (error) {
    throw new Error(error.message)
  }

  for (const property of properties ?? []) {
    if (!property.drive_folder_id) continue
    try {
      const stats = await syncPropertyDriveFolder({
        supabase: admin,
        orgId: property.org_id,
        propertyId: property.id,
        folderId: property.drive_folder_id,
      })
      aggregate.imported += stats.imported
      aggregate.replaced += stats.replaced
      aggregate.skipped += stats.skipped
      aggregate.missingOnDrive += stats.missingOnDrive
      aggregate.foundOnDrive += stats.foundOnDrive
      for (const e of stats.errors) {
        aggregate.errors.push(`${property.street_address}: ${e}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      errors.push(`${property.street_address ?? property.id}: ${message}`)
    }
  }

  return {
    properties: properties?.length ?? 0,
    stats: aggregate,
    errors,
  }
}
