'use server'

// Profile photo helpers for the signed-in person (corner avatar).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ProfileActionResult =
  | { success: true; avatarUrl?: string | null }
  | { success: false; error: string }

async function getCallerPerson() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, avatar_path')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  return { supabase, person }
}

/** Persist avatar storage path for the current user after a client-side upload. */
export async function updateOwnAvatarPath(
  avatarPath: string | null,
): Promise<ProfileActionResult> {
  const ctx = await getCallerPerson()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  if (avatarPath) {
    const prefix = `${ctx.person.org_id}/people/${ctx.person.id}/avatar/`
    if (!avatarPath.startsWith(prefix)) {
      return { success: false, error: 'Invalid avatar path.' }
    }
  }

  const previous = ctx.person.avatar_path

  const { error } = await ctx.supabase
    .from('people')
    .update({
      avatar_path: avatarPath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ctx.person.id)
    .eq('org_id', ctx.person.org_id)

  if (error) {
    console.error('[updateOwnAvatarPath]', error)
    return { success: false, error: 'Failed to save profile photo.' }
  }

  if (
    previous &&
    previous !== avatarPath &&
    previous.startsWith(`${ctx.person.org_id}/people/${ctx.person.id}/avatar/`)
  ) {
    await ctx.supabase.storage.from('org-assets').remove([previous])
  }

  let avatarUrl: string | null = null
  if (avatarPath) {
    const { data } = await ctx.supabase.storage
      .from('org-assets')
      .createSignedUrl(avatarPath, 3600)
    avatarUrl = data?.signedUrl ?? null
  }

  revalidatePath('/app')
  return { success: true, avatarUrl }
}
