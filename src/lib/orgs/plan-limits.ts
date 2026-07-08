import type { SupabaseClient } from '@supabase/supabase-js'

/** SaaS plan unit limits — Canary (first customer / platform dogfood) is exempt from free-tier caps. */

export const CANARY_ORG_SLUG = 'canary'

/** Floor for Canary Property Management — not subject to free-tier unit caps. */
export const CANARY_PLAN_UNIT_LIMIT = 500

/** Orgs at or above this limit are treated as having a manual/platform override. */
export const PLAN_LIMIT_EXEMPT_THRESHOLD = 200

export type OrgPlanInfo = {
  slug: string
  plan_unit_limit: number
}

export function isPlanLimitExempt(org: OrgPlanInfo): boolean {
  return org.slug === CANARY_ORG_SLUG || org.plan_unit_limit >= PLAN_LIMIT_EXEMPT_THRESHOLD
}

export function targetPlanLimitForImport(
  org: OrgPlanInfo,
  currentUnitCount: number,
  additionalUnits: number
): number {
  const needed = currentUnitCount + additionalUnits
  if (org.slug === CANARY_ORG_SLUG) {
    return Math.max(org.plan_unit_limit, CANARY_PLAN_UNIT_LIMIT, needed)
  }
  if (needed > org.plan_unit_limit) {
    return Math.max(needed + 10, 200)
  }
  return org.plan_unit_limit
}

/** Raise plan_unit_limit before bulk unit inserts so the DB trigger does not reject rows. */
export async function ensurePlanCapacityForImport(
  supabase: SupabaseClient,
  orgId: string,
  additionalUnits: number
): Promise<string | null> {
  if (additionalUnits <= 0) return null

  const [{ data: org }, { count }] = await Promise.all([
    supabase.from('organizations').select('slug, plan_unit_limit').eq('id', orgId).single(),
    supabase.from('units').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
  ])

  if (!org) return 'Could not read organization plan limit.'

  const current = count ?? 0
  const target = targetPlanLimitForImport(org, current, additionalUnits)
  if (target <= org.plan_unit_limit) return null

  const { error } = await supabase
    .from('organizations')
    .update({ plan_unit_limit: target })
    .eq('id', orgId)

  if (error) {
    console.error('[ensurePlanCapacityForImport]', error)
    return `Need room for ${additionalUnits} more units (currently ${current}/${org.plan_unit_limit}). Could not raise plan limit — ask an admin.`
  }
  return null
}
