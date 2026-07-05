import { createPublicClient } from '@/lib/supabase/public'

/**
 * Resolve an org slug to its id and name.
 * Uses the anon client — org names are not sensitive.
 * Returns null if the slug is empty or no matching org is found.
 */
export async function getOrgBySlug(
  slug: string
): Promise<{ id: string; name: string } | null> {
  if (!slug) return null

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  return data
}
