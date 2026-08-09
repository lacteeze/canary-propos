// GET /api/org-icon — serve the default org company logo as favicon.
// Falls back to the static Canary mark so tabs never break.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FALLBACK_PATH = path.join(process.cwd(), 'public', 'icon.png')
// Logo paths are timestamped on upload — long CDN cache is safe and cuts repeat egress.
const CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800, immutable'

async function fallbackIcon(): Promise<NextResponse> {
  try {
    const buf = await readFile(FALLBACK_PATH)
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': CACHE_CONTROL,
      },
    })
  } catch {
    return NextResponse.redirect(new URL('/icon.png', process.env.NEXT_PUBLIC_APP_URL || 'https://canarypm.ca'))
  }
}

export async function GET() {
  const slug = (process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG || 'canary').trim()

  try {
    const supabase = createAdminClient()
    const { data: org } = await supabase
      .from('organizations')
      .select('logo_path')
      .eq('slug', slug)
      .maybeSingle()

    const logoPath = org?.logo_path?.trim()
    if (!logoPath || logoPath.startsWith('pending/')) {
      return fallbackIcon()
    }

    const { data, error } = await supabase.storage.from('org-assets').download(logoPath)
    if (error || !data) {
      console.warn('[org-icon] download failed, using fallback:', error?.message)
      return fallbackIcon()
    }

    const bytes = Buffer.from(await data.arrayBuffer())
    const lower = logoPath.toLowerCase()
    const contentType =
      lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : lower.endsWith('.gif')
            ? 'image/gif'
            : lower.endsWith('.svg')
              ? 'image/svg+xml'
              : 'image/jpeg'

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': CACHE_CONTROL,
      },
    })
  } catch (err) {
    console.error('[org-icon] unexpected error:', err)
    return fallbackIcon()
  }
}
