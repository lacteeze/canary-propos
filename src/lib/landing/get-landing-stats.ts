import { createPublicClient } from '@/lib/supabase/public'
import { unstable_noStore as noStore } from 'next/cache'
import { getOrgBySlug } from '@/lib/orgs'
import { getHospitableStays } from './get-hospitable-stays'

export interface LandingStats {
  leaseCount: number
  strCount: number
  totalHomes: number
}

/**
 * Total homes available on the landing page hero:
 * published long-term listings (DB) + short-term stays (Hospitable feed with fallback).
 */
export async function getLandingStats(
  orgSlug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? 'canary',
  strCount?: number
): Promise<LandingStats> {
  noStore()
  const resolvedStrCount = strCount ?? (await getHospitableStays()).length
  const org = await getOrgBySlug(orgSlug)
  if (!org) {
    return { leaseCount: 0, strCount: resolvedStrCount, totalHomes: resolvedStrCount }
  }

  const supabase = createPublicClient()
  const { count } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('org_id', org.id)

  const leaseCount = count ?? 0
  return {
    leaseCount,
    strCount: resolvedStrCount,
    totalHomes: leaseCount + resolvedStrCount,
  }
}
