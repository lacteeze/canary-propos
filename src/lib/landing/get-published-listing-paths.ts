import { createPublicClient } from '@/lib/supabase/public'
import { unstable_noStore as noStore } from 'next/cache'
import { getOrgBySlug } from '@/lib/orgs'
import { listingPublicHref } from '@/lib/listings/listing-href'

/** Slug paths for sitemap — no photo signing. */
export async function getPublishedListingPaths(
  orgSlug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? 'canary',
): Promise<string[]> {
  noStore()
  const org = await getOrgBySlug(orgSlug)
  if (!org) return []

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('listings')
    .select('id, slug')
    .eq('status', 'published')
    .eq('org_id', org.id)

  return (data ?? []).map((row) => listingPublicHref({ id: row.id, slug: row.slug }, ''))
}
