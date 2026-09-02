// GET /api/og/property/[id] — stable hero image for social crawlers.
// Signed storage URLs expire; this path stays put and serves this property's
// listing cover, or the company mark if there isn't one.

import { NextResponse } from 'next/server'
import { isListingUuid } from '@/lib/listings/listing-href'
import {
  loadPropertyById,
  publicPropertyLookupClient,
} from '@/lib/listings/public-property-lookup'
import { getListingPhotoPathsForProperty } from '@/lib/storage/property-listing-media'
import { getOrgBySlug } from '@/lib/orgs'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400'

function orgIconFallback(): NextResponse {
  return NextResponse.redirect(
    new URL('/api/org-icon', process.env.NEXT_PUBLIC_APP_URL || 'https://canarypm.ca'),
    302,
  )
}

function contentTypeForPath(storagePath: string): string {
  const lower = storagePath.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  return 'image/jpeg'
}

async function heroStoragePath(propertyId: string, photoPaths: string[] | null): Promise<string | null> {
  const fromMedia = await getListingPhotoPathsForProperty(
    propertyId,
    publicPropertyLookupClient(),
  )
  const paths = (fromMedia.length > 0 ? fromMedia : (photoPaths ?? [])).filter(
    (p: string) => !!p && !/^https?:\/\//i.test(p),
  )
  return paths[0] ?? null
}

function imageResponse(body: ArrayBuffer, storagePath: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentTypeForPath(storagePath),
      'Cache-Control': CACHE_CONTROL,
    },
  })
}

async function downloadShareSizedHero(
  supabase: ReturnType<typeof createAdminClient>,
  storagePath: string,
): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage.from('org-assets').createSignedUrl(storagePath, 120, {
    transform: { width: 1200, quality: 70, resize: 'contain' },
  })
  if (error || !data?.signedUrl) return null
  try {
    const res = await fetch(data.signedUrl)
    if (!res.ok) return null
    const body = await res.arrayBuffer()
    if (!body.byteLength) return null
    return body
  } catch (err) {
    console.warn('[og-property] share-size fetch failed:', err)
    return null
  }
}

async function hasPublishedListing(orgId: string, propertyId: string): Promise<boolean> {
  const client = publicPropertyLookupClient()
  const { data: units } = await client
    .from('units')
    .select('id')
    .eq('property_id', propertyId)
    .eq('org_id', orgId)
  const unitIds = ((units ?? []) as Array<{ id: string }>).map((u) => u.id)
  if (!unitIds.length) return false
  const { data } = await client
    .from('listings')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'published')
    .in('unit_id', unitIds)
    .limit(1)
    .maybeSingle()
  return data != null
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params
  const propertyId = decodeURIComponent(rawId ?? '').trim()
  if (!isListingUuid(propertyId)) {
    return orgIconFallback()
  }

  const orgSlug = (process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG || 'canary').trim()

  try {
    const org = await getOrgBySlug(orgSlug)
    if (!org) return orgIconFallback()

    const property = await loadPropertyById(org.id, propertyId)
    if (!property) return orgIconFallback()
    if (!property.slug && !(await hasPublishedListing(org.id, propertyId))) {
      return orgIconFallback()
    }

    const storagePath = await heroStoragePath(property.id, property.photo_paths)
    if (!storagePath) return orgIconFallback()

    const supabase = createAdminClient()
    const resized = await downloadShareSizedHero(supabase, storagePath)
    if (resized) return imageResponse(resized, storagePath)

    const { data, error } = await supabase.storage.from('org-assets').download(storagePath)
    if (error || !data) {
      console.warn('[og-property] download failed, using org icon:', error?.message)
      return orgIconFallback()
    }

    return imageResponse(await data.arrayBuffer(), storagePath)
  } catch (err) {
    console.error('[og-property] unexpected error:', err)
    return orgIconFallback()
  }
}
