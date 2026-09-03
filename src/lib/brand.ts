export type OrgBrand = {
  name: string
  publicBaseUrl: string
  senderEmail: string
  supportEmail: string
  defaultProvince: string
  defaultCity: string
}

const CANARY_BRAND: OrgBrand = {
  name: 'Canary Property Management',
  publicBaseUrl: 'https://canarypm.ca',
  senderEmail: 'notifications@canarypm.ca',
  supportEmail: 'info@canarypm.ca',
  defaultProvince: 'NL',
  defaultCity: "St. John's",
}

export function brandFromOrg(org?: {
  slug?: string | null
  name?: string | null
  province?: string | null
  city?: string | null
} | null): OrgBrand {
  if (!org || org.slug === 'canary') return CANARY_BRAND
  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  return {
    name: org.name?.trim() || 'Property management',
    publicBaseUrl: site || CANARY_BRAND.publicBaseUrl,
    senderEmail: CANARY_BRAND.senderEmail,
    supportEmail: CANARY_BRAND.supportEmail,
    defaultProvince: org.province?.trim() || '',
    defaultCity: org.city?.trim() || '',
  }
}

export function defaultProvinceFromOrg(orgProvince?: string | null): string {
  return orgProvince?.trim() || ''
}
