import { headers } from 'next/headers'
import { getOrgBySlug } from '@/lib/orgs'

export async function resolveOnboardOrg(orgSlugParam?: string | null) {
  const headersList = await headers()
  const orgSlug =
    headersList.get('x-org-slug') ||
    orgSlugParam ||
    process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ||
    'canary'
  const org = await getOrgBySlug(orgSlug)
  if (!org) return null
  return { ...org, slug: orgSlug }
}

export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://canarypm.ca').replace(/\/$/, '')
}
