'use server'

import { createClient } from '@/lib/supabase/server'
import { signOrgAssetPaths } from '@/lib/storage/listing-photos'

/**
 * Batch-sign listing cover paths for the authenticated Properties Photos view.
 * One round-trip for the whole portfolio (covers only) — no N+1.
 */
export async function signPropertyCoverPaths(
  paths: Array<string | null | undefined>
): Promise<string[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return paths.map(() => '')

  return signOrgAssetPaths(paths, supabase, 'signPropertyCoverPaths')
}
