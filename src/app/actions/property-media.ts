'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult =
  | { success: true }
  | { success: false; error: string }

export type PropertyMediaVisibility = 'listing' | 'private'

export type PropertyMediaItem = {
  id: string
  storagePath: string
  visibility: PropertyMediaVisibility
  sortOrder: number
  caption: string | null
}

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

async function syncLegacyPhotoPaths(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  propertyId: string,
  orgId: string
) {
  const { data: listingRows } = await supabase
    .from('property_media')
    .select('storage_path, sort_order')
    .eq('property_id', propertyId)
    .eq('org_id', orgId)
    .eq('visibility', 'listing')
    .order('sort_order', { ascending: true })

  const photoPaths = (listingRows ?? []).map(
    (row: { storage_path: string }) => row.storage_path
  )

  await supabase
    .from('properties')
    .update({ photo_paths: photoPaths, updated_at: new Date().toISOString() })
    .eq('id', propertyId)
    .eq('org_id', orgId)
}

export async function listPropertyMedia(
  propertyId: string
): Promise<{ success: true; items: PropertyMediaItem[] } | { success: false; error: string }> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  const { data, error } = await ctx.supabase
    .from('property_media')
    .select('id, storage_path, visibility, sort_order, caption')
    .eq('property_id', propertyId)
    .eq('org_id', ctx.person.org_id)
    .order('visibility', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[listPropertyMedia]', error)
    return { success: false, error: 'Failed to load photos.' }
  }

  return {
    success: true,
    items: (data ?? []).map((row) => ({
      id: row.id,
      storagePath: row.storage_path,
      visibility: row.visibility as PropertyMediaVisibility,
      sortOrder: row.sort_order,
      caption: row.caption,
    })),
  }
}

const addSchema = z.object({
  propertyId: z.string().uuid(),
  storagePath: z.string().min(1),
  visibility: z.enum(['listing', 'private']),
  caption: z.string().max(200).optional().nullable(),
})

export async function addPropertyMedia(input: {
  propertyId: string
  storagePath: string
  visibility: PropertyMediaVisibility
  caption?: string | null
}): Promise<ActionResult & { id?: string }> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }
  if (!isManager(ctx.person.role as unknown as string[])) {
    return { success: false, error: 'Only managers can upload property photos.' }
  }

  const parsed = addSchema.safeParse(input)
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

  const { data: existing } = await ctx.supabase
    .from('property_media')
    .select('sort_order')
    .eq('property_id', parsed.data.propertyId)
    .eq('visibility', parsed.data.visibility)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data: inserted, error } = await ctx.supabase
    .from('property_media')
    .insert({
      org_id: ctx.person.org_id,
      property_id: parsed.data.propertyId,
      storage_path: parsed.data.storagePath,
      visibility: parsed.data.visibility,
      sort_order: nextOrder,
      caption: parsed.data.caption ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[addPropertyMedia]', error)
    return { success: false, error: 'Failed to save photo. Please try again.' }
  }

  if (parsed.data.visibility === 'listing') {
    await syncLegacyPhotoPaths(ctx.supabase, parsed.data.propertyId, ctx.person.org_id)
  }

  revalidatePath('/properties/' + parsed.data.propertyId)
  revalidatePath('/app')
  return { success: true, id: inserted?.id }
}

const reorderSchema = z.object({
  propertyId: z.string().uuid(),
  visibility: z.enum(['listing', 'private']),
  orderedIds: z.array(z.string().uuid()).min(1),
})

/** Persist thumbnail grid order. First listing photo is the public cover. */
export async function reorderPropertyMedia(input: {
  propertyId: string
  visibility: PropertyMediaVisibility
  orderedIds: string[]
}): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }
  if (!isManager(ctx.person.role as unknown as string[])) {
    return { success: false, error: 'Only managers can reorder property photos.' }
  }

  const parsed = reorderSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { propertyId, visibility, orderedIds } = parsed.data

  const { data: rows, error: fetchError } = await ctx.supabase
    .from('property_media')
    .select('id')
    .eq('property_id', propertyId)
    .eq('org_id', ctx.person.org_id)
    .eq('visibility', visibility)

  if (fetchError) {
    console.error('[reorderPropertyMedia:fetch]', fetchError)
    return { success: false, error: 'Failed to load photos for reorder.' }
  }

  const existingIds = new Set((rows ?? []).map((r) => r.id))
  if (
    orderedIds.length !== existingIds.size ||
    orderedIds.some((id) => !existingIds.has(id))
  ) {
    return { success: false, error: 'Photo list is out of date. Refresh and try again.' }
  }

  const now = new Date().toISOString()
  const updates = await Promise.all(
    orderedIds.map((id, index) =>
      ctx.supabase
        .from('property_media')
        .update({ sort_order: index, updated_at: now })
        .eq('id', id)
        .eq('org_id', ctx.person.org_id)
    )
  )

  const failed = updates.find((u) => u.error)
  if (failed?.error) {
    console.error('[reorderPropertyMedia:update]', failed.error)
    return { success: false, error: 'Failed to save photo order.' }
  }

  if (visibility === 'listing') {
    await syncLegacyPhotoPaths(ctx.supabase, propertyId, ctx.person.org_id)
  }

  revalidatePath('/properties/' + propertyId)
  revalidatePath('/app')
  revalidatePath('/')
  revalidatePath('/listings')
  return { success: true }
}

export async function deletePropertyMedia(
  mediaId: string
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }
  if (!isManager(ctx.person.role as unknown as string[])) {
    return { success: false, error: 'Only managers can delete property photos.' }
  }

  const { data: row, error: fetchError } = await ctx.supabase
    .from('property_media')
    .select('id, property_id, storage_path, visibility')
    .eq('id', mediaId)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !row) {
    return { success: false, error: 'Photo not found.' }
  }

  const { error: storageError } = await ctx.supabase.storage
    .from('org-assets')
    .remove([row.storage_path])

  if (storageError) {
    console.error('[deletePropertyMedia:storage]', storageError)
  }

  const { error } = await ctx.supabase
    .from('property_media')
    .delete()
    .eq('id', mediaId)
    .eq('org_id', ctx.person.org_id)

  if (error) {
    console.error('[deletePropertyMedia]', error)
    return { success: false, error: 'Failed to delete photo.' }
  }

  if (row.visibility === 'listing') {
    await syncLegacyPhotoPaths(ctx.supabase, row.property_id, ctx.person.org_id)
  }

  revalidatePath('/properties/' + row.property_id)
  revalidatePath('/app')
  return { success: true }
}

/** @deprecated Prefer addPropertyMedia — kept for older callers that pass full path arrays. */
export async function updatePropertyPhotos(
  id: string,
  photoPaths: string[]
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }
  if (!isManager(ctx.person.role as unknown as string[])) {
    return { success: false, error: 'Only managers can update property photos.' }
  }

  const { data: existing, error: fetchError } = await ctx.supabase
    .from('properties')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Property not found.' }
  }

  const { data: currentListing } = await ctx.supabase
    .from('property_media')
    .select('id, storage_path')
    .eq('property_id', id)
    .eq('org_id', ctx.person.org_id)
    .eq('visibility', 'listing')

  const currentPaths = new Set((currentListing ?? []).map((r) => r.storage_path))
  const nextPaths = photoPaths.filter(Boolean)
  const nextSet = new Set(nextPaths)

  for (const row of currentListing ?? []) {
    if (!nextSet.has(row.storage_path)) {
      await ctx.supabase.from('property_media').delete().eq('id', row.id)
    }
  }

  for (let i = 0; i < nextPaths.length; i++) {
    const path = nextPaths[i]
    if (currentPaths.has(path)) {
      await ctx.supabase
        .from('property_media')
        .update({ sort_order: i, updated_at: new Date().toISOString() })
        .eq('property_id', id)
        .eq('storage_path', path)
        .eq('visibility', 'listing')
    } else {
      await ctx.supabase.from('property_media').insert({
        org_id: ctx.person.org_id,
        property_id: id,
        storage_path: path,
        visibility: 'listing',
        sort_order: i,
      })
    }
  }

  await syncLegacyPhotoPaths(ctx.supabase, id, ctx.person.org_id)
  revalidatePath('/properties/' + id)
  revalidatePath('/app')
  return { success: true }
}
